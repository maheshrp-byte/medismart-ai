import { useEffect, useState } from 'react'
import { supabase } from './lib/supabaseClient'

function DoctorAppointments({ onBack }) {
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function loadAppointments() {
    setLoading(true)
    setError('')
    setMessage('')

    try {
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          id,
          patient_id,
          doctor_id,
          appointment_date,
          appointment_time,
          reason,
          status,
          created_at,
          doctors (
            name,
            specialization,
            hospital,
            location
          )
        `)
        .order('appointment_date', {
          ascending: true,
        })

      if (error) {
        throw error
      }

      setAppointments(data || [])
    } catch (err) {
      console.error('Appointment loading error:', err)

      setError(
        err.message ||
        'Unable to load appointments.'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAppointments()
  }, [])

  async function updateStatus(id, status) {
    setError('')
    setMessage('')

    try {
      const { error } = await supabase
        .from('appointments')
        .update({
          status,
        })
        .eq('id', id)

      if (error) {
        throw error
      }

      setMessage(
        status === 'confirmed'
          ? '✅ Appointment confirmed successfully.'
          : '❌ Appointment rejected successfully.'
      )

      await loadAppointments()
    } catch (err) {
      console.error('Status update error:', err)

      setError(
        err.message ||
        'Unable to update appointment status.'
      )
    }
  }

  function formatDate(date) {
    if (!date) return 'N/A'

    return new Date(
      `${date}T00:00:00`
    ).toLocaleDateString(
      undefined,
      {
        dateStyle: 'medium',
      }
    )
  }

  function formatTime(time) {
    if (!time) return 'N/A'

    const [hours, minutes] = time.split(':')

    const date = new Date()

    date.setHours(
      Number(hours),
      Number(minutes),
      0,
      0
    )

    return date.toLocaleTimeString(
      undefined,
      {
        hour: 'numeric',
        minute: '2-digit',
      }
    )
  }

  return (
    <section className="health-history">

      <button
        className="back-button"
        onClick={onBack}
      >
        ← Back to Dashboard
      </button>

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

      <div className="ai-disclaimer">
        ⚠️ Appointment information is confidential.
        Only authorized healthcare staff should access
        and manage patient appointments.
      </div>

      {error && (
        <div className="ai-error">
          ⚠️ {error}
        </div>
      )}

      {message && (
        <div
          style={{
            padding: '15px',
            marginBottom: '20px',
            borderRadius: '10px',
            background: '#e8f8ef',
            color: '#087f46',
            textAlign: 'center',
          }}
        >
          {message}
        </div>
      )}

      <div className="history-toolbar">

        <strong>
          {appointments.length}{' '}
          {appointments.length === 1
            ? 'appointment'
            : 'appointments'}
        </strong>

        <button
          className="history-refresh-button"
          onClick={loadAppointments}
          disabled={loading}
        >
          🔄 {loading ? 'Loading...' : 'Refresh'}
        </button>

      </div>

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

      {!loading &&
        appointments.length > 0 && (

          <div className="history-list">

            {appointments.map((appointment) => {

              const doctor =
                appointment.doctors

              return (
                <div
                  className="history-card"
                  key={appointment.id}
                >

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
                        {doctor?.name || 'Doctor'}
                      </h3>

                    </div>

                  </div>

                  <div className="history-symptoms">

                    <p>
                      <strong>
                        Specialization:
                      </strong>{' '}
                      {doctor?.specialization || 'N/A'}
                    </p>

                    <p>
                      <strong>
                        Hospital:
                      </strong>{' '}
                      {doctor?.hospital || 'N/A'}
                    </p>

                    <p>
                      <strong>
                        Location:
                      </strong>{' '}
                      {doctor?.location || 'N/A'}
                    </p>

                    <p>
                      <strong>
                        Date:
                      </strong>{' '}
                      {formatDate(
                        appointment.appointment_date
                      )}
                    </p>

                    <p>
                      <strong>
                        Time:
                      </strong>{' '}
                      {formatTime(
                        appointment.appointment_time
                      )}
                    </p>

                    <p>
                      <strong>
                        Reason:
                      </strong>{' '}
                      {appointment.reason ||
                        'Not provided'}
                    </p>

                    <p>
                      <strong>
                        Status:
                      </strong>{' '}

                      <span
                        style={{
                          fontWeight: '700',
                          textTransform: 'capitalize',
                        }}
                      >
                        {appointment.status}
                      </span>

                    </p>

                  </div>

                  {appointment.status === 'pending' && (

                    <div
                      style={{
                        display: 'flex',
                        gap: '10px',
                        flexWrap: 'wrap',
                        marginTop: '15px',
                      }}
                    >

                      <button
                        className="history-view-button"
                        onClick={() =>
                          updateStatus(
                            appointment.id,
                            'confirmed'
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
                            'rejected'
                          )
                        }
                        style={{
                          background: '#fff',
                          color: '#d93025',
                          border:
                            '1px solid #f1a5a5',
                        }}
                      >
                        ❌ Reject
                      </button>

                    </div>

                  )}

                  {appointment.status === 'confirmed' && (
                    <div
                      style={{
                        marginTop: '15px',
                        padding: '10px',
                        borderRadius: '8px',
                        background: '#e8f8ef',
                        color: '#087f46',
                        textAlign: 'center',
                        fontWeight: '600',
                      }}
                    >
                      🟢 Appointment Confirmed
                    </div>
                  )}

                  {appointment.status === 'rejected' && (
                    <div
                      style={{
                        marginTop: '15px',
                        padding: '10px',
                        borderRadius: '8px',
                        background: '#fff0f0',
                        color: '#c62828',
                        textAlign: 'center',
                        fontWeight: '600',
                      }}
                    >
                      🔴 Appointment Rejected
                    </div>
                  )}

                </div>
              )
            })}

          </div>
        )}

    </section>
  )
}

export default DoctorAppointments