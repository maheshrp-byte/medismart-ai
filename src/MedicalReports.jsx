import { useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient";
import "./MedicalReports.css";

const BUCKET_NAME = "medical report";
const ANALYZER_FUNCTION = "medical-report-analyzer";

function MedicalReports({onBack}) {
  const [user, setUser] = useState(null);
  const [reports, setReports] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);

  const [loading, setLoading] = useState(false);
  const [loadingReports, setLoadingReports] = useState(true);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [analyzingReportId, setAnalyzingReportId] = useState(null);

  // NEW: selected report for full AI analysis
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

  function renderAIText(text) {
    if (!text) {
      return null;
    }

    return text.split("\n").map(
      (line, index) => {
        const trimmed = line.trim();

        if (!trimmed) {
          return (
            <div
              key={index}
              style={{
                height: "10px",
              }}
            />
          );
        }

        const isHeading =
          /^(\d+[\.\)]|#+)\s/.test(trimmed) ||
          /^(Report overview|Important findings|Values that may need attention|Simple explanation|What to discuss with your doctor|Important warning signs|Disclaimer)/i.test(
            trimmed
          );

        if (isHeading) {
          return (
            <h3
              key={index}
              style={{
                marginTop: "20px",
                marginBottom: "8px",
              }}
            >
              {trimmed.replace(/^#+\s*/, "")}
            </h3>
          );
        }

        if (
          trimmed.startsWith("- ") ||
          trimmed.startsWith("* ") ||
          trimmed.startsWith("• ")
        ) {
          return (
            <div
              key={index}
              style={{
                marginBottom: "7px",
                paddingLeft: "10px",
              }}
            >
              •{" "}
              {trimmed.replace(
                /^[-*•]\s*/,
                ""
              )}
            </div>
          );
        }

        return (
          <p
            key={index}
            style={{
              margin: "0 0 9px 0",
              lineHeight: "1.65",
            }}
          >
            {trimmed}
          </p>
        );
      }
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

          ⚠️ Medical reports may contain sensitive
          information. MediSmart AI provides
          informational assistance and does not
          replace professional medical advice.

        </div>


        {/* UPLOAD */}

        <section className="upload-card">

          <h2>
            Upload Medical Report
          </h2>

          <p className="upload-description">
            Supported formats: PDF, JPG, PNG and WEBP.
            Maximum size: 10 MB.
          </p>

          <div className="file-input-wrapper">

            <input
              id="medical-report-file"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              onChange={handleFileChange}
            />

          </div>


          {selectedFile && (

            <div className="selected-file">

              <span>
                📎
              </span>

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
              ? "Uploading and analyzing..."
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

              <p>
                Loading your reports...
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


                    {/* AI SUMMARY */}

                    {report.ai_summary ? (

                      <div className="summary-preview">

                        <strong>
                          🤖 AI Analysis Ready
                        </strong>

                        <p>

                          {report.ai_summary.length > 250
                            ? `${report.ai_summary.slice(
                                0,
                                250
                              )}...`
                            : report.ai_summary}

                        </p>

                      </div>

                    ) : analyzingReportId === report.id ? (

                      <div className="pending-analysis">

                        🤖 AI is analyzing
                        this medical report...

                      </div>

                    ) : (

                      <div className="pending-analysis">

                        🤖 AI analysis is
                        not available yet.

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
                          className="view-button"
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
          onClick={() =>
            setSelectedAnalysis(null)
          }
          style={{
            position: "fixed",
            inset: 0,
            background:
              "rgba(0, 0, 0, 0.55)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
        >

          <div
            onClick={(event) =>
              event.stopPropagation()
            }
            style={{
              width: "100%",
              maxWidth: "850px",
              maxHeight: "90vh",
              overflowY: "auto",
              background: "#ffffff",
              borderRadius: "20px",
              padding: "30px",
              boxSizing: "border-box",
              boxShadow:
                "0 20px 60px rgba(0,0,0,0.25)",
            }}
          >

            {/* MODAL HEADER */}

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: "20px",
                marginBottom: "25px",
              }}
            >

              <div>

                <p
                  className="section-label"
                  style={{
                    marginBottom: "6px",
                  }}
                >
                  MEDISMART AI
                </p>

                <h2
                  style={{
                    margin: "0 0 8px 0",
                  }}
                >
                  🤖 AI Medical Report Analysis
                </h2>

                <strong>
                  {selectedAnalysis.file_name}
                </strong>

                <p
                  className="report-date"
                  style={{
                    marginTop: "6px",
                  }}
                >
                  {selectedAnalysis.created_at
                    ? new Date(
                        selectedAnalysis.created_at
                      ).toLocaleString()
                    : "Unknown date"}
                </p>

              </div>


              <button
                onClick={() =>
                  setSelectedAnalysis(null)
                }
                style={{
                  border: "none",
                  background: "#f1f5f9",
                  borderRadius: "50%",
                  width: "40px",
                  height: "40px",
                  cursor: "pointer",
                  fontSize: "18px",
                  flexShrink: 0,
                }}
                aria-label="Close"
              >
                ✕
              </button>

            </div>


            {/* AI BADGE */}

            <div
              style={{
                background:
                  "linear-gradient(135deg, #eef2ff, #f0fdf4)",
                borderRadius: "14px",
                padding: "15px 18px",
                marginBottom: "22px",
                border:
                  "1px solid #e2e8f0",
              }}
            >

              <strong>
                ✨ AI-generated health information
              </strong>

              <p
                style={{
                  margin:
                    "6px 0 0 0",
                  lineHeight: "1.5",
                }}
              >
                This analysis helps explain the
                information contained in your report
                in simpler language.
              </p>

            </div>


            {/* FULL AI RESPONSE */}

            <div
              style={{
                fontSize: "15px",
                color: "#334155",
              }}
            >

              {renderAIText(
                selectedAnalysis.ai_summary
              )}

            </div>


            {/* DISCLAIMER */}

            <div
              style={{
                marginTop: "25px",
                padding: "18px",
                borderRadius: "12px",
                background: "#fff7ed",
                border:
                  "1px solid #fed7aa",
                lineHeight: "1.55",
                fontSize: "14px",
              }}
            >

              <strong>
                ⚠️ Important Medical Disclaimer
              </strong>

              <p
                style={{
                  marginBottom: 0,
                }}
              >
                This AI-generated analysis is for
                educational and informational purposes
                only. It is not a medical diagnosis and
                does not replace advice from a qualified
                healthcare professional. Do not start,
                stop, or change medication based only
                on this AI response.
              </p>

            </div>


            {/* MODAL ACTIONS */}

            <div
              style={{
                display: "flex",
                gap: "10px",
                flexWrap: "wrap",
                marginTop: "25px",
              }}
            >

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
                className="view-button"
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