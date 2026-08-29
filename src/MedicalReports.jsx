import { useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient";
import "./MedicalReports.css";

const BUCKET_NAME = "medical report";
const ANALYZER_FUNCTION = "medical-report-analyzer";

function MedicalReports({ onBack }) {
  const [user, setUser] = useState(null);
  const [reports, setReports] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);

  const [loading, setLoading] = useState(false);
  const [loadingReports, setLoadingReports] = useState(true);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [analyzingReportId, setAnalyzingReportId] = useState(null);
  const [selectedAnalysis, setSelectedAnalysis] = useState(null);

  useEffect(() => {
    loadUserAndReports();
  }, []);

  // =========================================================
  // LOAD USER + REPORTS
  // =========================================================

  async function loadUserAndReports() {
    setLoadingReports(true);
    setError("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setError("Please log in first.");
        setLoadingReports(false);
        return;
      }

      setUser(user);

      const { data, error: reportsError } = await supabase
        .from("medical_reports")
        .select(
          "id, patient_id, file_name, file_url, report_text, ai_summary, created_at"
        )
        .eq("patient_id", user.id)
        .order("created_at", { ascending: false });

      if (reportsError) {
        console.error("Load reports error:", reportsError);
        setError("Unable to load your medical reports.");
      } else {
        setReports(data || []);
      }
    } catch (err) {
      console.error("Load reports error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load your medical reports."
      );
    } finally {
      setLoadingReports(false);
    }
  }

  // =========================================================
  // FILE SELECTION
  // =========================================================

  function handleFileChange(event) {
    setError("");
    setMessage("");

    const file = event.target.files?.[0];

    if (!file) {
      setSelectedFile(null);
      return;
    }

    const allowedTypes = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (!allowedTypes.includes(file.type)) {
      setError("Please select a PDF, JPG, PNG, or WEBP file.");
      event.target.value = "";
      setSelectedFile(null);
      return;
    }

    const maxSize = 10 * 1024 * 1024;

    if (file.size > maxSize) {
      setError("Please select a file smaller than 10 MB.");
      event.target.value = "";
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
  }

  // =========================================================
  // UPLOAD REPORT
  // =========================================================

  async function uploadReport() {
    if (!selectedFile) {
      setError("Please select a medical report first.");
      return;
    }

    if (!user) {
      setError("Please log in first.");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const file = selectedFile;

      const safeFileName = file.name
        .replace(/[^a-zA-Z0-9._-]/g, "_")
        .replace(/\s+/g, "_");

      const filePath = `${user.id}/${Date.now()}-${safeFileName}`;

      // -------------------------------------------------------
      // 1. Upload file
      // -------------------------------------------------------

      const { error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type,
        });

      if (uploadError) {
        console.error("Storage upload error:", uploadError);
        throw new Error(uploadError.message);
      }

      // -------------------------------------------------------
      // 2. Create signed URL
      // -------------------------------------------------------

      const {
        data: signedUrlData,
        error: urlError,
      } = await supabase.storage
        .from(BUCKET_NAME)
        .createSignedUrl(filePath, 60 * 60);

      if (urlError) {
        await supabase.storage
          .from(BUCKET_NAME)
          .remove([filePath]);

        throw new Error(
          "Unable to create a secure URL for the uploaded report."
        );
      }

      const fileUrl = signedUrlData?.signedUrl;

      if (!fileUrl) {
        await supabase.storage
          .from(BUCKET_NAME)
          .remove([filePath]);

        throw new Error("Unable to create the report URL.");
      }

      // -------------------------------------------------------
      // 3. Save database record
      // -------------------------------------------------------

      const {
        data: insertedReport,
        error: insertError,
      } = await supabase
        .from("medical_reports")
        .insert({
          patient_id: user.id,
          file_name: file.name,
          file_url: fileUrl,
          report_text: null,
          ai_summary: null,
        })
        .select()
        .single();

      if (insertError) {
        await supabase.storage
          .from(BUCKET_NAME)
          .remove([filePath]);

        throw new Error(insertError.message);
      }

      // -------------------------------------------------------
      // 4. Clear input
      // -------------------------------------------------------

      setSelectedFile(null);

      const fileInput = document.getElementById(
        "medical-report-file"
      );

      if (fileInput) {
        fileInput.value = "";
      }

      setMessage(
        "✅ Medical report uploaded. AI analysis is starting..."
      );

      // -------------------------------------------------------
      // 5. Add immediately to UI
      // -------------------------------------------------------

      setReports((previousReports) => [
        insertedReport,
        ...previousReports,
      ]);

      // -------------------------------------------------------
      // 6. Start AI analysis
      // -------------------------------------------------------

      await analyzeReport(
        insertedReport.id,
        filePath,
        file.type,
        file.name
      );
    } catch (err) {
      console.error("Upload error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while uploading the report."
      );
    } finally {
      setLoading(false);
    }
  }

  // =========================================================
  // AI ANALYSIS
  // =========================================================

  async function analyzeReport(
    reportId,
    filePath,
    mimeType,
    fileName
  ) {
    setAnalyzingReportId(reportId);
    setError("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error("Your login session has expired.");
      }

      const {
        data,
        error: functionError,
      } = await supabase.functions.invoke(
        ANALYZER_FUNCTION,
        {
          body: {
            report_id: reportId,
            file_path: filePath,
            file_name: fileName,
            mime_type: mimeType,
          },
        }
      );

      if (functionError) {
        console.error(
          "Medical report analyzer error:",
          functionError
        );

        throw new Error(
          functionError.message ||
            "Unable to analyze the medical report."
        );
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      setMessage(
        "✅ Medical report uploaded and AI analysis completed successfully."
      );

      await loadUserAndReports();
    } catch (err) {
      console.error(
        "Medical report AI analysis error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "The report was uploaded, but AI analysis failed."
      );

      await loadUserAndReports();
    } finally {
      setAnalyzingReportId(null);
    }
  }

  // =========================================================
  // RETRY ANALYSIS
  // =========================================================

  async function retryAnalysis(report) {
    if (!user) {
      setError("Please log in first.");
      return;
    }

    try {
      setError("");
      setMessage("");

      const filePath = getStoragePathFromUrl(
        report.file_url
      );

      if (!filePath) {
        throw new Error(
          "Unable to determine the storage path for this report."
        );
      }

      const mimeType = getMimeTypeFromFileName(
        report.file_name
      );

      await analyzeReport(
        report.id,
        filePath,
        mimeType,
        report.file_name
      );
    } catch (err) {
      console.error("Retry analysis error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to retry the AI analysis."
      );
    }
  }

  // =========================================================
  // STORAGE PATH
  // =========================================================

  function getStoragePathFromUrl(fileUrl) {
    if (!fileUrl) {
      return null;
    }

    try {
      const url = new URL(fileUrl);

      const marker = "/storage/v1/object/sign/";

      const index =
        url.pathname.indexOf(marker);

      if (index === -1) {
        return null;
      }

      const path = url.pathname.substring(
        index + marker.length
      );

      const decodedPath =
        decodeURIComponent(path);

      const bucketPrefix =
        `${BUCKET_NAME}/`;

      if (decodedPath.startsWith(bucketPrefix)) {
        return decodedPath.substring(
          bucketPrefix.length
        );
      }

      return decodedPath;
    } catch (err) {
      console.error(
        "Storage path extraction error:",
        err
      );

      return null;
    }
  }

  // =========================================================
  // MIME TYPE
  // =========================================================

  function getMimeTypeFromFileName(fileName) {
    const extension =
      fileName
        ?.split(".")
        .pop()
        ?.toLowerCase();

    switch (extension) {
      case "pdf":
        return "application/pdf";

      case "jpg":
      case "jpeg":
        return "image/jpeg";

      case "png":
        return "image/png";

      case "webp":
        return "image/webp";

      default:
        return "application/octet-stream";
    }
  }

  // =========================================================
  // VIEW ORIGINAL REPORT
  // =========================================================

  async function viewReport(report) {
    setError("");

    try {
      const filePath =
        getStoragePathFromUrl(report.file_url);

      if (!filePath) {
        setError("File URL is not available.");
        return;
      }

      const {
        data,
        error: signedUrlError,
      } = await supabase.storage
        .from(BUCKET_NAME)
        .createSignedUrl(
          filePath,
          60 * 10
        );

      if (signedUrlError) {
        console.error(
          "View report error:",
          signedUrlError
        );

        setError(
          "Unable to open this medical report."
        );

        return;
      }

      if (!data?.signedUrl) {
        setError(
          "Unable to generate a secure report URL."
        );

        return;
      }

      window.open(
        data.signedUrl,
        "_blank",
        "noopener,noreferrer"
      );
    } catch (err) {
      console.error(err);

      setError(
        "Unable to open this medical report."
      );
    }
  }

  // =========================================================
  // DELETE REPORT
  // =========================================================

  async function deleteReport(report) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this medical report?"
    );

    if (!confirmed) {
      return;
    }

    try {
      setError("");
      setMessage("");

      const filePath =
        getStoragePathFromUrl(report.file_url);

      if (filePath) {
        const {
          error: storageError,
        } = await supabase.storage
          .from(BUCKET_NAME)
          .remove([filePath]);

        if (storageError) {
          console.error(
            "Storage delete error:",
            storageError
          );
        }
      }

      const {
        error: deleteError,
      } = await supabase
        .from("medical_reports")
        .delete()
        .eq("id", report.id)
        .eq("patient_id", user.id);

      if (deleteError) {
        throw new Error(deleteError.message);
      }

      if (
        selectedAnalysis?.id === report.id
      ) {
        setSelectedAnalysis(null);
      }

      setMessage(
        "Medical report deleted successfully."
      );

      await loadUserAndReports();
    } catch (err) {
      console.error(
        "Delete report error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to delete the report."
      );
    }
  }

  // =========================================================
  // FILE SIZE
  // =========================================================

  function formatFileSize(bytes) {
    if (!bytes) {
      return "";
    }

    const mb =
      bytes / (1024 * 1024);

    return `${mb.toFixed(2)} MB`;
  }

  // =========================================================
  // FORMAT AI TEXT
  // =========================================================

  function renderInlineText(text) {
    if (!text) {
      return null;
    }

    const parts = text.split(
      /(\*\*[^*]+\*\*|\*[^*]+\*)/g
    );

    return parts.map((part, index) => {
      if (
        part.startsWith("**") &&
        part.endsWith("**")
      ) {
        return (
          <strong key={index}>
            {part.slice(2, -2)}
          </strong>
        );
      }

      if (
        part.startsWith("*") &&
        part.endsWith("*")
      ) {
        return (
          <em key={index}>
            {part.slice(1, -1)}
          </em>
        );
      }

      return (
        <span key={index}>
          {part}
        </span>
      );
    });
  }

  function getHeadingInfo(text) {
    const cleaned = text
      .replace(/^#+\s*/, "")
      .replace(/^\d+[\.\)]\s*/, "")
      .trim();

    const headingPatterns = [
      "report overview",
      "overview",
      "summary",
      "executive summary",
      "important findings",
      "key findings",
      "findings",
      "test results",
      "lab results",
      "results",
      "values that may need attention",
      "abnormal values",
      "abnormal results",
      "results needing attention",
      "simple explanation",
      "explanation",
      "what this means",
      "what to discuss with your doctor",
      "doctor discussion",
      "recommendations",
      "recommendation",
      "important warning signs",
      "warning signs",
      "when to seek medical help",
      "next steps",
      "disclaimer",
    ];

    const normalized = cleaned
      .replace(/:$/, "")
      .toLowerCase();

    const matched = headingPatterns.some(
      (heading) =>
        normalized === heading
    );

    if (matched) {
      return cleaned.replace(/:$/, "");
    }

    return null;
  }

  function renderAIText(text) {
    if (!text) {
      return (
        <div className="analysis-empty">
          No AI analysis is available.
        </div>
      );
    }

    const lines = text
      .replace(/\r\n/g, "\n")
      .split("\n");

    const elements = [];

    let bulletItems = [];
    let numberedItems = [];

    const flushBullets = () => {
      if (bulletItems.length === 0) {
        return;
      }

      elements.push(
        <ul
          className="analysis-bullet-list"
          key={`bullets-${elements.length}`}
        >
          {bulletItems.map((item, index) => (
            <li key={index}>
              {renderInlineText(item)}
            </li>
          ))}
        </ul>
      );

      bulletItems = [];
    };

    const flushNumbers = () => {
      if (numberedItems.length === 0) {
        return;
      }

      elements.push(
        <ol
          className="analysis-number-list"
          key={`numbers-${elements.length}`}
        >
          {numberedItems.map((item, index) => (
            <li key={index}>
              {renderInlineText(item)}
            </li>
          ))}
        </ol>
      );

      numberedItems = [];
    };

    lines.forEach((line, index) => {
      const trimmed = line.trim();

      if (!trimmed) {
        return;
      }

      // -------------------------------------------------------
      // Markdown heading
      // -------------------------------------------------------

      if (/^#{1,6}\s+/.test(trimmed)) {
        flushBullets();
        flushNumbers();

        const heading = trimmed
          .replace(/^#{1,6}\s+/, "")
          .trim();

        elements.push(
          <div
            className="analysis-section-title"
            key={`heading-${index}`}
          >
            <span className="analysis-section-line"></span>
            <h3>
              {renderInlineText(
                heading.replace(/:$/, "")
              )}
            </h3>
          </div>
        );

        return;
      }

      // -------------------------------------------------------
      // Numbered heading
      // Example: 1. Report Overview
      // -------------------------------------------------------

      if (
        /^\d+[\.\)]\s+[A-Za-z][^:]{2,80}:?$/.test(
          trimmed
        )
      ) {
        flushBullets();
        flushNumbers();

        const heading = trimmed
          .replace(
            /^\d+[\.\)]\s+/,
            ""
          )
          .replace(/:$/, "")
          .trim();

        const knownHeading =
          getHeadingInfo(trimmed);

        if (knownHeading || heading.length < 70) {
          elements.push(
            <div
              className="analysis-section-title"
              key={`number-heading-${index}`}
            >
              <span className="analysis-section-line"></span>
              <h3>
                {renderInlineText(heading)}
              </h3>
            </div>
          );

          return;
        }
      }

      // -------------------------------------------------------
      // Known heading without markdown
      // -------------------------------------------------------

      const knownHeading =
        getHeadingInfo(trimmed);

      if (knownHeading) {
        flushBullets();
        flushNumbers();

        elements.push(
          <div
            className="analysis-section-title"
            key={`known-heading-${index}`}
          >
            <span className="analysis-section-line"></span>
            <h3>
              {renderInlineText(knownHeading)}
            </h3>
          </div>
        );

        return;
      }

      // -------------------------------------------------------
      // Bullet points
      // -------------------------------------------------------

      if (
        /^[-*•]\s+/.test(trimmed)
      ) {
        flushNumbers();

        bulletItems.push(
          trimmed.replace(
            /^[-*•]\s+/,
            ""
          )
        );

        return;
      }

      // -------------------------------------------------------
      // Numbered list
      // -------------------------------------------------------

      if (
        /^\d+[\.\)]\s+/.test(trimmed)
      ) {
        flushBullets();

        numberedItems.push(
          trimmed.replace(
            /^\d+[\.\)]\s+/,
            ""
          )
        );

        return;
      }

      // -------------------------------------------------------
      // Important / warning lines
      // -------------------------------------------------------

      if (
        /^(⚠️|warning:|important:)/i.test(
          trimmed
        )
      ) {
        flushBullets();
        flushNumbers();

        elements.push(
          <div
            className="analysis-warning"
            key={`warning-${index}`}
          >
            {renderInlineText(trimmed)}
          </div>
        );

        return;
      }

      // -------------------------------------------------------
      // Normal paragraph
      // -------------------------------------------------------

      flushBullets();
      flushNumbers();

      elements.push(
        <p
          className="analysis-paragraph"
          key={`paragraph-${index}`}
        >
          {renderInlineText(trimmed)}
        </p>
      );
    });

    flushBullets();
    flushNumbers();

    return (
      <div className="analysis-content">
        {elements}
      </div>
    );
  }

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <div className="medical-reports-page">

      <div className="medical-reports-container">

        {/* BACK */}

        <button
          className="back-button"
          onClick={onBack}
        >
          ← Back to dashboard
        </button>

        {/* HEADER */}

        <div className="reports-header">

          <div className="reports-icon">
            📄
          </div>

          <div>

            <p className="section-label">
              MEDISMART AI
            </p>

            <h1>
              Medical Reports
            </h1>

            <p>
              Upload your medical reports and
              understand them with AI.
            </p>

          </div>

        </div>

        {/* DISCLAIMER */}

        <div className="medical-disclaimer">

          <span className="disclaimer-icon">
            ⚠️
          </span>

          <div>
            <strong>
              Medical Information Notice
            </strong>

            <p>
              Medical reports may contain sensitive
              information. MediSmart AI provides
              informational assistance and does not
              replace professional medical advice.
            </p>
          </div>

        </div>

        {/* UPLOAD */}

        <section className="upload-card">

          <div className="card-heading">

            <div className="card-heading-icon">
              📤
            </div>

            <div>
              <h2>
                Upload Medical Report
              </h2>

              <p className="upload-description">
                Upload a report and let MediSmart AI
                explain the important information.
              </p>
            </div>

          </div>

          <div className="file-input-wrapper">

            <input
              id="medical-report-file"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              onChange={handleFileChange}
            />

          </div>

          <p className="file-help">
            Supported formats: PDF, JPG, PNG and WEBP
            · Maximum size: 10 MB
          </p>

          {selectedFile && (

            <div className="selected-file">

              <div className="selected-file-icon">
                📎
              </div>

              <div>

                <strong>
                  {selectedFile.name}
                </strong>

                <small>
                  {formatFileSize(
                    selectedFile.size
                  )}
                </small>

              </div>

            </div>

          )}

          {error && (

            <div className="error-message">
              ⚠️ {error}
            </div>

          )}

          {message && (

            <div className="success-message">
              {message}
            </div>

          )}

          <button
            className="upload-button"
            onClick={uploadReport}
            disabled={
              loading ||
              !selectedFile
            }
          >
            {loading
              ? "⏳ Uploading and analyzing..."
              : "📤 Upload Report"}
          </button>

        </section>

        {/* REPORTS */}

        <section className="reports-section">

          <div className="reports-section-header">

            <div>

              <p className="section-label">
                YOUR RECORDS
              </p>

              <h2>
                Previous Medical Reports
              </h2>

            </div>

            <button
              className="refresh-button"
              onClick={loadUserAndReports}
              disabled={loadingReports}
            >
              🔄{" "}
              {loadingReports
                ? "Loading..."
                : "Refresh"}
            </button>

          </div>

          {loadingReports ? (

            <div className="empty-state">

              <div className="loading-icon">
                ⏳
              </div>

              <h3>
                Loading your reports...
              </h3>

              <p>
                Please wait while we retrieve
                your medical records.
              </p>

            </div>

          ) : reports.length === 0 ? (

            <div className="empty-state">

              <div className="empty-icon">
                📄
              </div>

              <h3>
                No medical reports yet
              </h3>

              <p>
                Upload your first medical report
                using the form above.
              </p>

            </div>

          ) : (

            <div className="reports-list">

              {reports.map((report) => (

                <article
                  className="report-card"
                  key={report.id}
                >

                  <div className="report-card-icon">
                    📄
                  </div>

                  <div className="report-card-content">

                    <div className="report-card-heading">

                      <div>
                        <h3>
                          {report.file_name}
                        </h3>

                        <p className="report-date">
                          {report.created_at
                            ? new Date(
                                report.created_at
                              ).toLocaleString()
                            : "Unknown date"}
                        </p>
                      </div>

                      {report.ai_summary && (
                        <span className="analysis-ready-badge">
                          ✓ AI Ready
                        </span>
                      )}

                    </div>

                    {/* AI SUMMARY */}

                    {report.ai_summary ? (

                      <div className="summary-preview">

                        <div className="summary-preview-title">
                          🤖 AI Analysis Available
                        </div>

                        <p>
                          {report.ai_summary.length > 280
                            ? `${report.ai_summary.slice(
                                0,
                                280
                              )}...`
                            : report.ai_summary}
                        </p>

                      </div>

                    ) : analyzingReportId === report.id ? (

                      <div className="pending-analysis">

                        <span>
                          🤖
                        </span>

                        <div>
                          <strong>
                            AI is analyzing this report
                          </strong>

                          <p>
                            Please wait. This may take
                            a few moments.
                          </p>
                        </div>

                      </div>

                    ) : (

                      <div className="pending-analysis">

                        <span>
                          ℹ️
                        </span>

                        <div>
                          <strong>
                            AI analysis is not available
                          </strong>

                          <p>
                            You can try analyzing this
                            report again.
                          </p>
                        </div>

                      </div>

                    )}

                    {/* ACTIONS */}

                    <div className="report-actions">

                      <button
                        onClick={() =>
                          viewReport(report)
                        }
                        className="view-button"
                      >
                        👁️ View Report
                      </button>

                      {report.ai_summary && (

                        <button
                          onClick={() =>
                            setSelectedAnalysis(report)
                          }
                          className="view-button analysis-button"
                        >
                          🤖 View AI Analysis
                        </button>

                      )}

                      {!report.ai_summary &&
                        analyzingReportId !==
                          report.id && (

                          <button
                            onClick={() =>
                              retryAnalysis(report)
                            }
                            className="view-button"
                          >
                            ✨ Analyze
                          </button>

                        )}

                      <button
                        onClick={() =>
                          deleteReport(report)
                        }
                        className="delete-button"
                      >
                        🗑️ Delete
                      </button>

                    </div>

                  </div>

                </article>

              ))}

            </div>

          )}

        </section>

      </div>

      {/* =====================================================
          FULL AI ANALYSIS MODAL
      ===================================================== */}

      {selectedAnalysis && (

        <div
          className="analysis-modal-overlay"
          onClick={() =>
            setSelectedAnalysis(null)
          }
        >

          <div
            className="analysis-modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >

            {/* MODAL HEADER */}

            <div className="analysis-modal-header">

              <div className="analysis-modal-title">

                <div className="analysis-modal-icon">
                  🤖
                </div>

                <div>

                  <p className="section-label">
                    MEDISMART AI
                  </p>

                  <h2>
                    Medical Report Analysis
                  </h2>

                  <strong>
                    {selectedAnalysis.file_name}
                  </strong>

                  <p className="report-date">
                    {selectedAnalysis.created_at
                      ? new Date(
                          selectedAnalysis.created_at
                        ).toLocaleString()
                      : "Unknown date"}
                  </p>

                </div>

              </div>

              <button
                className="analysis-close-button"
                onClick={() =>
                  setSelectedAnalysis(null)
                }
                aria-label="Close"
              >
                ✕
              </button>

            </div>

            {/* AI INTRO */}

            <div className="analysis-intro">

              <div className="analysis-intro-icon">
                ✨
              </div>

              <div>

                <strong>
                  AI-generated health information
                </strong>

                <p>
                  This analysis explains the information
                  found in your medical report in simpler
                  language.
                </p>

              </div>

            </div>

            {/* QUICK INFO */}

            <div className="analysis-info-grid">

              <div className="analysis-info-card">

                <span>
                  📄
                </span>

                <div>
                  <small>
                    Report
                  </small>

                  <strong>
                    Uploaded
                  </strong>
                </div>

              </div>

              <div className="analysis-info-card">

                <span>
                  🤖
                </span>

                <div>
                  <small>
                    Analysis
                  </small>

                  <strong>
                    Completed
                  </strong>
                </div>

              </div>

            </div>

            {/* FULL AI RESPONSE */}

            <div className="analysis-report-box">

              <div className="analysis-report-heading">
                <span>
                  📋
                </span>

                <div>
                  <strong>
                    Report Explanation
                  </strong>

                  <small>
                    AI-generated interpretation
                  </small>
                </div>
              </div>

              {renderAIText(
                selectedAnalysis.ai_summary
              )}

            </div>

            {/* DISCLAIMER */}

            <div className="analysis-disclaimer">

              <div className="analysis-disclaimer-icon">
                ⚠️
              </div>

              <div>

                <strong>
                  Important Medical Disclaimer
                </strong>

                <p>
                  This AI-generated analysis is for
                  educational and informational purposes
                  only. It is not a medical diagnosis and
                  does not replace advice from a qualified
                  healthcare professional. Do not start,
                  stop, or change medication based only
                  on this AI response.
                </p>

              </div>

            </div>

            {/* MODAL ACTIONS */}

            <div className="analysis-modal-actions">

              <button
                className="view-button"
                onClick={() =>
                  viewReport(
                    selectedAnalysis
                  )
                }
              >
                📄 View Original Report
              </button>

              <button
                className="delete-button"
                onClick={() => {
                  deleteReport(
                    selectedAnalysis
                  );
                }}
              >
                🗑️ Delete Report
              </button>

              <button
                className="close-analysis-button"
                onClick={() =>
                  setSelectedAnalysis(null)
                }
              >
                Close
              </button>

            </div>

          </div>

        </div>

      )}

    </div>
  );
}

export default MedicalReports;