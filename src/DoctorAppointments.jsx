import { useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient";

function DoctorAppointments({ onBack }) {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadAppointments() {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      // -----------------------------------------
      // 1. Get appointments
      // -----------------------------------------
      const {
        data: appointmentData,
        error: appointmentError,
      } = await supabase
        .from("appointments")
        .select(`
          id,
          patient_id,
          doctor_id,
          appointment_date,
          appointment_time,
          reason,
          status,
          created_at
        `)
        .order("appointment_date", {
          ascending: true,
        });

      if (appointmentError) {
        throw appointmentError;
      }

      const appointmentsList = appointmentData || [];

      // -----------------------------------------
      // 2. Get unique doctor IDs
      // -----------------------------------------
      const doctorIds = [
        ...new Set(
          appointmentsList
            .map((appointment) => appointment.doctor_id)
            .filter((id) => id !== null && id !== undefined)
        ),
      ];

      // -----------------------------------------
      // 3. Get doctors directly from doctors table
      // -----------------------------------------
      let doctorsList = [];

      if (doctorIds.length > 0) {
        const {
          data: doctorData,
          error: doctorError,
        } = await supabase
          .from("doctors")
          .select(`
            id,
            name,
            specialization,
            hospital,
            location,
            consultation_fee
          `)
          .in("id", doctorIds);

        if (doctorError) {
          throw doctorError;
        }

        doctorsList = doctorData || [];
      }

      // -----------------------------------------
      // 4. Create doctor lookup
      // -----------------------------------------
      const doctorMap = {};

      doctorsList.forEach((doctor) => {
        doctorMap[String(doctor.id)] = doctor;
      });

      // -----------------------------------------
      // 5. Attach doctor information to appointment
      // -----------------------------------------
      const finalAppointments = appointmentsList.map((appointment) => {
        const doctor = doctorMap[String(appointment.doctor_id)] || null;

        return {
          ...appointment,
          doctor,
        };
      });

      setAppointments(finalAppointments);
    } catch (err) {
      console.error("Appointment loading error:", err);

      setError(
        err.message || "Unable to load appointments."
      );
    } finally {
      setLoading(false);
    }
  }

  // -----------------------------------------
  // Load appointments when page opens
  // -----------------------------------------
  useEffect(() => {
    loadAppointments();
  }, []);

  // -----------------------------------------
  // Update appointment status
  // -----------------------------------------
  async function updateStatus(id, status) {
    setError("");
    setMessage("");

    try {
      const { error: updateError } = await supabase
        .from("appointments")
        .update({
          status: status,
        })
        .eq("id", id);

      if (updateError) {
        throw updateError;
      }

      if (status === "confirmed") {
        setMessage(
          "✅ Appointment confirmed successfully."
        );
      } else if (status === "rejected") {
        setMessage(
          "❌ Appointment rejected successfully."
        );
      }

      await loadAppointments();
    } catch (err) {
      console.error("Status update error:", err);

      setError(
        err.message ||
          "Unable to update appointment status."
      );
    }
  }

  // -----------------------------------------
  // Format date
  // -----------------------------------------
  function formatDate(date) {
    if (!date) return "N/A";

    return new Date(
      `${date}T00:00:00`
    ).toLocaleDateString(undefined, {
      dateStyle: "medium",
    });
  }

  // -----------------------------------------
  // Format time
  // -----------------------------------------
  function formatTime(time) {
    if (!time) return "N/A";

    const [hours, minutes] = time.split(":");

    const date = new Date();

    date.setHours(
      Number(hours),
      Number(minutes),
      0,
      0
    );

    return date.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  // -----------------------------------------
  // Status color
  // -----------------------------------------
  function getStatusStyle(status) {
    if (status === "confirmed") {
      return {
        color: "#087f46",
        background: "#e8f8ef",
        padding: "4px 10px",
        borderRadius: "20px",
      };
    }

    if (status === "rejected") {
      return {
        color: "#c62828",
        background: "#fff0f0",
        padding: "4px 10px",
        borderRadius: "20px",
      };
    }

    if (status === "cancelled") {
      return {
        color: "#b26a00",
        background: "#fff4df",
        padding: "4px 10px",
        borderRadius: "20px",
      };
    }

    return {
      color: "#8a5a00",
      background: "#fff8dc",
      padding: "4px 10px",
      borderRadius: "20px",
    };
  }

  // -----------------------------------------
  // No doctor information
  // -----------------------------------------
  function DoctorInformation({ doctor }) {
    if (!doctor) {
      return (
        <>
          <h3>Doctor information unavailable</h3>

          <p>
            <strong>Doctor ID:</strong>{" "}
            Not found
          </p>

          <p>
            <strong>Specialization:</strong> N/A
          </p>

          <p>
            <strong>Hospital:</strong> N/A
          </p>

          <p>
            <strong>Location:</strong> N/A
          </p>
        </>
      );
    }

    return (
      <>
        <h3>
          {doctor.name || "Doctor"}
        </h3>

        <p>
          <strong>Specialization:</strong>{" "}
          {doctor.specialization || "N/A"}
        </p>

        <p>
          <strong>Hospital:</strong>{" "}
          {doctor.hospital || "N/A"}
        </p>

        <p>
          <strong>Location:</strong>{" "}
          {doctor.location || "N/A"}
        </p>

        {doctor.consultation_fee !== null &&
          doctor.consultation_fee !== undefined && (
            <p>
              <strong>Consultation Fee:</strong>{" "}
              ₹{doctor.consultation_fee}
            </p>
          )}
      </>
    );
  }

  // -----------------------------------------
  // Page
  // -----------------------------------------
  return (
    <section className="health-history">

      {/* Back button */}
      <button
        className="back-button"
        onClick={onBack}
      >
        ← Back to Dashboard
      </button>

      {/* Header */}
      <div className="history-header">

        <div className="history-icon">
          🩺
        </div>

        <div>
          <span className="dashboard-label">
            MEDISMART AI
          </span>

          <h1>
            Doctor Appointments
          </h1>

          <p>
            Review and manage patient appointments.
          </p>
        </div>

      </div>

      {/* Disclaimer */}
      <div className="ai-disclaimer">
        ⚠️ Appointment information is confidential.
        Only authorized healthcare staff should access
        and manage patient appointments.
      </div>

      {/* Error */}
      {error && (
        <div className="ai-error">
          ⚠️ {error}
        </div>
      )}

      {/* Success message */}
      {message && (
        <div
          style={{
            padding: "15px",
            marginBottom: "20px",
            borderRadius: "10px",
            background: "#e8f8ef",
            color: "#087f46",
            textAlign: "center",
            fontWeight: "600",
          }}
        >
          {message}
        </div>
      )}

      {/* Toolbar */}
      <div className="history-toolbar">

        <strong>
          {appointments.length}{" "}
          {appointments.length === 1
            ? "appointment"
            : "appointments"}
        </strong>

        <button
          className="history-refresh-button"
          onClick={loadAppointments}
          disabled={loading}
        >
          🔄{" "}
          {loading
            ? "Loading..."
            : "Refresh"}
        </button>

      </div>

      {/* Loading */}
      {loading && (
        <div className="history-empty">

          <div className="history-loading-icon">
            ⏳
          </div>

          <h2>
            Loading appointments...
          </h2>

        </div>
      )}

      {/* No appointments */}
      {!loading &&
        !error &&
        appointments.length === 0 && (
          <div className="history-empty">

            <div className="history-loading-icon">
              📅
            </div>

            <h2>
              No appointments found
            </h2>

            <p>
              Patient appointments will appear here.
            </p>

          </div>
        )}

      {/* Appointment list */}
      {!loading &&
        appointments.length > 0 && (

          <div className="history-list">

            {appointments.map((appointment) => {

              const doctor =
                appointment.doctor;

              return (
                <div
                  className="history-card"
                  key={appointment.id}
                >

                  {/* Top */}
                  <div className="history-card-top">

                    <div className="history-card-icon">
                      👨‍⚕️
                    </div>

                    <div className="history-card-info">

                      <span className="history-date">
                        {formatDate(
                          appointment.appointment_date
                        )}
                      </span>

                      <h3>
                        {doctor?.name ||
                          "Doctor"}
                      </h3>

                    </div>

                  </div>

                  {/* Details */}
                  <div className="history-symptoms">

                    <DoctorInformation
                      doctor={doctor}
                    />

                    <p>
                      <strong>
                        Date:
                      </strong>{" "}
                      {formatDate(
                        appointment.appointment_date
                      )}
                    </p>

                    <p>
                      <strong>
                        Time:
                      </strong>{" "}
                      {formatTime(
                        appointment.appointment_time
                      )}
                    </p>

                    <p>
                      <strong>
                        Reason:
                      </strong>{" "}
                      {appointment.reason ||
                        "Not provided"}
                    </p>

                    <p>
                      <strong>
                        Status:
                      </strong>{" "}

                      <span
                        style={{
                          ...getStatusStyle(
                            appointment.status
                          ),
                          fontWeight: "700",
                          textTransform:
                            "capitalize",
                        }}
                      >
                        {appointment.status ||
                          "pending"}
                      </span>
                    </p>

                  </div>

                  {/* Pending buttons */}
                  {appointment.status ===
                    "pending" && (

                    <div
                      style={{
                        display: "flex",
                        gap: "10px",
                        flexWrap: "wrap",
                        marginTop: "15px",
                      }}
                    >

                      <button
                        className="history-view-button"
                        onClick={() =>
                          updateStatus(
                            appointment.id,
                            "confirmed"
                          )
                        }
                      >
                        ✅ Confirm
                      </button>

                      <button
                        className="history-close-main-button"
                        onClick={() =>
                          updateStatus(
                            appointment.id,
                            "rejected"
                          )
                        }
                        style={{
                          background: "#fff0f0",
                          color: "#d93025",
                          border:
                            "1px solid #f1a5a5",
                        }}
                      >
                        ❌ Reject
                      </button>

                    </div>

                  )}

                  {/* Confirmed */}
                  {appointment.status ===
                    "confirmed" && (

                    <div
                      style={{
                        marginTop: "15px",
                        padding: "10px",
                        borderRadius: "8px",
                        background: "#e8f8ef",
                        color: "#087f46",
                        textAlign: "center",
                        fontWeight: "600",
                      }}
                    >
                      🟢 Appointment Confirmed
                    </div>

                  )}

                  {/* Rejected */}
                  {appointment.status ===
                    "rejected" && (

                    <div
                      style={{
                        marginTop: "15px",
                        padding: "10px",
                        borderRadius: "8px",
                        background: "#fff0f0",
                        color: "#c62828",
                        textAlign: "center",
                        fontWeight: "600",
                      }}
                    >
                      🔴 Appointment Rejected
                    </div>

                  )}

                  {/* Cancelled */}
                  {appointment.status ===
                    "cancelled" && (

                    <div
                      style={{
                        marginTop: "15px",
                        padding: "10px",
                        borderRadius: "8px",
                        background: "#fff4df",
                        color: "#b26a00",
                        textAlign: "center",
                        fontWeight: "600",
                      }}
                    >
                      🟠 Appointment Cancelled
                    </div>

                  )}

                </div>
              );
            })}

          </div>

        )}

    </section>
  );
}

export default DoctorAppointments;