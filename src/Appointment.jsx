import { useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient";

function Appointment({ doctor, onBack }) {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [user, setUser] = useState(null);

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      setUser(user);
    };

    getUser();
  }, []);

  const today = new Date().toISOString().split("T")[0];

  const handleBooking = async (e) => {
    e.preventDefault();

    setError("");
    setMessage("");

    if (!user) {
      setError("Please log in before booking an appointment.");
      return;
    }

    if (!date) {
      setError("Please select an appointment date.");
      return;
    }

    if (!time) {
      setError("Please select an appointment time.");
      return;
    }

    setLoading(true);

    try {
      const { error: bookingError } = await supabase
        .from("appointments")
        .insert({
          patient_id: user.id,
          doctor_id: doctor.id,
          appointment_date: date,
          appointment_time: time,
          reason: reason.trim() || null,
          status: "pending",
        });

      if (bookingError) {
        throw bookingError;
      }

      setMessage(
        "✅ Appointment booked successfully! Your appointment is pending confirmation."
      );

      setDate("");
      setTime("");
      setReason("");
    } catch (err) {
      console.error("Appointment booking error:", err);
      setError(
        err.message || "Unable to book the appointment. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  if (!doctor) {
    return (
      <div className="page">
        <div className="card">
          <h2>No doctor selected</h2>
          <button onClick={onBack}>← Back to Doctors</button>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="card">
        <button
          type="button"
          onClick={onBack}
          style={{
            marginBottom: "25px",
            padding: "10px 18px",
            cursor: "pointer",
          }}
        >
          ← Back to Doctors
        </button>

        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "45px" }}>👨‍⚕️</div>

          <h1>Book Appointment</h1>

          <h2>{doctor.name}</h2>

          <p>
            <strong>{doctor.specialization}</strong>
          </p>

          <p>🏥 {doctor.hospital}</p>

          <p>📍 {doctor.location}</p>

          <p>💰 ₹{doctor.consultation_fee} consultation</p>
        </div>

        <hr style={{ margin: "30px 0" }} />

        {message && (
          <div
            style={{
              padding: "15px",
              marginBottom: "20px",
              background: "#e8f8ef",
              color: "#087443",
              borderRadius: "10px",
              textAlign: "center",
            }}
          >
            {message}
          </div>
        )}

        {error && (
          <div
            style={{
              padding: "15px",
              marginBottom: "20px",
              background: "#fff0f0",
              color: "#d93025",
              borderRadius: "10px",
              textAlign: "center",
            }}
          >
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleBooking}>
          <div style={{ marginBottom: "20px" }}>
            <label>
              <strong>Appointment Date</strong>
            </label>

            <input
              type="date"
              value={date}
              min={today}
              onChange={(e) => setDate(e.target.value)}
              style={{
                width: "100%",
                padding: "13px",
                marginTop: "8px",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ marginBottom: "20px" }}>
            <label>
              <strong>Appointment Time</strong>
            </label>

            <select
              value={time}
              onChange={(e) => setTime(e.target.value)}
              style={{
                width: "100%",
                padding: "13px",
                marginTop: "8px",
                boxSizing: "border-box",
              }}
            >
              <option value="">Select time</option>
              <option value="09:00">09:00 AM</option>
              <option value="10:00">10:00 AM</option>
              <option value="11:00">11:00 AM</option>
              <option value="12:00">12:00 PM</option>
              <option value="14:00">02:00 PM</option>
              <option value="15:00">03:00 PM</option>
              <option value="16:00">04:00 PM</option>
              <option value="17:00">05:00 PM</option>
              <option value="18:00">06:00 PM</option>
            </select>
          </div>

          <div style={{ marginBottom: "25px" }}>
            <label>
              <strong>Reason for Visit</strong>
            </label>

            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Briefly describe why you want to consult this doctor..."
              maxLength={500}
              rows={5}
              style={{
                width: "100%",
                padding: "13px",
                marginTop: "8px",
                boxSizing: "border-box",
                resize: "vertical",
              }}
            />

            <small>{reason.length}/500</small>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "15px",
              fontSize: "18px",
              fontWeight: "bold",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Booking..." : "📅 Book Appointment"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Appointment;