import { useEffect, useState } from 'react'
import { supabase } from './lib/supabaseClient'

function FindDoctor({ onBookAppointment }) {
  const [doctors, setDoctors] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [specialization, setSpecialization] = useState('All')

  const loadDoctors = async () => {
    setLoading(true)
    setError('')

    try {
      const { data, error } = await supabase
        .from('doctors')
        .select('*')
        .order('name', { ascending: true })

      if (error) {
        throw error
      }

      setDoctors(data || [])
    } catch (err) {
      console.error('Doctor loading error:', err)
      setError(err.message || 'Unable to load doctors.')
    }

    setLoading(false)
  }

  useEffect(() => {
    loadDoctors()
  }, [])

  const specializations = [
    'All',
    ...new Set(
      doctors
        .map((doctor) => doctor.specialization)
        .filter(Boolean)
    ),
  ]

  const filteredDoctors = doctors.filter((doctor) => {
    const searchText = search.toLowerCase().trim()

    const matchesSearch =
      !searchText ||
      doctor.name?.toLowerCase().includes(searchText) ||
      doctor.specialization?.toLowerCase().includes(searchText) ||
      doctor.hospital?.toLowerCase().includes(searchText) ||
      doctor.location?.toLowerCase().includes(searchText)

    const matchesSpecialization =
      specialization === 'All' ||
      doctor.specialization === specialization

    return matchesSearch && matchesSpecialization
  })

  return (
    <section className="find-doctor">

      <button
        className="back-button"
        onClick={() => window.history.back()}
      >
        ← Back to Dashboard
      </button>

      <div className="history-header">

        <div className="history-icon">
          👨‍⚕️
        </div>

        <div>
          <span className="dashboard-label">
            MEDISMART AI
          </span>

          <h1>
            Find a Doctor
          </h1>

          <p>
            Find doctors based on specialization,
            location and availability.
          </p>
        </div>

      </div>

      <div className="ai-disclaimer">
        ⚠️ Doctor information is provided for
        informational purposes. Please verify
        availability and consultation details
        before visiting.
      </div>

      <div className="doctor-search-card">

        <div className="doctor-search-row">

          <div className="doctor-search-input">

            <label>
              Search Doctors
            </label>

            <input
              type="text"
              placeholder="Search by name, hospital or location..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

          </div>

          <div className="doctor-search-input">

            <label>
              Specialization
            </label>

            <select
              value={specialization}
              onChange={(e) =>
                setSpecialization(e.target.value)
              }
            >
              {specializations.map((item) => (
                <option
                  key={item}
                  value={item}
                >
                  {item}
                </option>
              ))}
            </select>

          </div>

          <button
            className="history-refresh-button"
            onClick={loadDoctors}
            disabled={loading}
          >
            🔄 Refresh
          </button>

        </div>

      </div>

      {error && (
        <div className="ai-error">
          ⚠️ {error}
        </div>
      )}

      {loading && (
        <div className="history-empty">
          <div className="history-loading-icon">
            ⏳
          </div>

          <h2>
            Finding doctors...
          </h2>

          <p>
            Please wait while we load available doctors.
          </p>
        </div>
      )}

      {!loading && !error && filteredDoctors.length === 0 && (
        <div className="history-empty">

          <div className="history-loading-icon">
            👨‍⚕️
          </div>

          <h2>
            No doctors found
          </h2>

          <p>
            Try changing your search or specialization.
          </p>

        </div>
      )}

      {!loading && filteredDoctors.length > 0 && (
        <div className="doctor-grid">

          {filteredDoctors.map((doctor) => (

            <div
              className="doctor-card"
              key={doctor.id}
            >

              <div className="doctor-card-header">

                <div className="doctor-avatar">
                  👨‍⚕️
                </div>

                <div>
                  <h2>
                    {doctor.name || 'Doctor'}
                  </h2>

                  <p className="doctor-specialization">
                    {doctor.specialization ||
                      'General Physician'}
                  </p>
                </div>

              </div>

              <div className="doctor-details">

                {doctor.qualification && (
                  <div className="doctor-detail">
                    🎓
                    <span>
                      {doctor.qualification}
                    </span>
                  </div>
                )}

                {doctor.experience !== null &&
                  doctor.experience !== undefined && (
                    <div className="doctor-detail">
                      💼
                      <span>
                        {doctor.experience} years experience
                      </span>
                    </div>
                  )}

                {doctor.hospital && (
                  <div className="doctor-detail">
                    🏥
                    <span>
                      {doctor.hospital}
                    </span>
                  </div>
                )}

                {doctor.location && (
                  <div className="doctor-detail">
                    📍
                    <span>
                      {doctor.location}
                    </span>
                  </div>
                )}

                {doctor.consultation_fee !== null &&
                  doctor.consultation_fee !== undefined && (
                    <div className="doctor-detail">
                      💰
                      <span>
                        ₹{doctor.consultation_fee}
                        {' '}consultation
                      </span>
                    </div>
                  )}

                <div className="doctor-detail">
                  {doctor.available ? '🟢' : '🔴'}
                  <span>
                    {doctor.available
                      ? 'Available'
                      : 'Currently unavailable'}
                  </span>
                </div>

              </div>

              <div className="doctor-actions">

                {doctor.phone && (
                  <a
                    className="doctor-call-button"
                    href={`tel:${doctor.phone}`}
                  >
                    📞 Call
                  </a>
                )}

                {doctor.email && (
                  <a
                    className="doctor-email-button"
                    href={`mailto:${doctor.email}`}
                  >
                    ✉️ Email
                  </a>
                )}
                <button
                   type="button"
                   onClick={() => onBookAppointment(doctor)}
                   style={{
                        marginTop: "15px",
                      padding: "10px 20px",
                     cursor: "pointer",
                   }}
                >
                   📅 Book Appointment
                </button>

              </div>

            </div>

          ))}

        </div>
      )}

    </section>
  )
}

export default FindDoctor