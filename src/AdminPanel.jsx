import { useEffect, useState } from 'react'
import { supabase } from './lib/supabaseClient'

function AdminPanel({ onBack }) {
  const [doctors, setDoctors] = useState([])
  const [appointments, setAppointments] = useState([])

  const totalDoctors = doctors.length

  const totalAppointments = appointments.length

  const confirmedAppointments =
    appointments.filter(
      (appointment) =>
        appointment.status === 'confirmed'
    ).length

  const pendingAppointments =
    appointments.filter(
      (appointment) =>
        appointment.status === 'pending'
    ).length

  const cancelledAppointments =
    appointments.filter(
      (appointment) =>
        appointment.status === 'cancelled'
    ).length

  const totalPatients =
    new Set(
      appointments.map(
        (appointment) =>
          appointment.patient_id
      )
    ).size

  const [loading, setLoading] = useState(true)
  const [appointmentsLoading, setAppointmentsLoading] =
    useState(true)

  const [saving, setSaving] = useState(false)

  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const [showForm, setShowForm] = useState(false)
  const [editingDoctor, setEditingDoctor] = useState(null)

  const emptyForm = {
    name: '',
    specialization: '',
    qualification: '',
    experience_years: '',
    hospital: '',
    location: '',
    phone: '',
    email: '',
    consultation_fee: '',
    available: true
  }

  const [form, setForm] = useState(emptyForm)

  // =====================================================
  // LOAD DOCTORS
  // =====================================================

  const loadDoctors = async () => {
    try {
      setLoading(true)
      setError('')

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

      setError(
        err.message || 'Unable to load doctors.'
      )
    } finally {
      setLoading(false)
    }
  }

  // =====================================================
  // LOAD APPOINTMENTS
  // =====================================================

  const loadAppointments = async () => {
    try {
      setAppointmentsLoading(true)

      const { data, error } = await supabase
        .from('appointments')
        .select(`
          id,
          patient_id,
          doctor_id,
          appointment_date,
          appointment_time,
          status,
          reason,
          notes,
          created_at,
          doctors (
            name,
            specialization,
            hospital,
            location
          )
        `)
        .order('appointment_date', {
          ascending: true
        })

      if (error) {
        throw error
      }

      setAppointments(data || [])
    } catch (err) {
      console.error(
        'Appointment loading error:',
        err
      )

      setError(
        err.message ||
          'Unable to load appointments.'
      )
    } finally {
      setAppointmentsLoading(false)
    }
  }

  // =====================================================
  // INITIAL LOAD
  // =====================================================

  useEffect(() => {
    loadDoctors()
    loadAppointments()
  }, [])

  // =====================================================
  // FORM INPUT
  // =====================================================

  const handleChange = (e) => {
    const {
      name,
      value,
      type,
      checked
    } = e.target

    setForm((previous) => ({
      ...previous,
      [name]:
        type === 'checkbox'
          ? checked
          : value
    }))
  }

  // =====================================================
  // ADD DOCTOR
  // =====================================================

  const openAddForm = () => {
    setEditingDoctor(null)
    setForm(emptyForm)

    setMessage('')
    setError('')

    setShowForm(true)
  }

  // =====================================================
  // EDIT DOCTOR
  // =====================================================

  const openEditForm = (doctor) => {
    setEditingDoctor(doctor)

    setForm({
      name: doctor.name || '',

      specialization:
        doctor.specialization || '',

      qualification:
        doctor.qualification || '',

      experience_years:
        doctor.experience_years ?? '',

      hospital:
        doctor.hospital || '',

      location:
        doctor.location || '',

      phone:
        doctor.phone || '',

      email:
        doctor.email || '',

      consultation_fee:
        doctor.consultation_fee ?? '',

      available:
        doctor.available ?? true
    })

    setMessage('')
    setError('')

    setShowForm(true)
  }

  // =====================================================
  // CLOSE FORM
  // =====================================================

  const closeForm = () => {
    setShowForm(false)
    setEditingDoctor(null)
    setForm(emptyForm)
  }

  // =====================================================
  // ADD / UPDATE DOCTOR
  // =====================================================

  const handleSubmit = async (e) => {
    e.preventDefault()

    setMessage('')
    setError('')

    if (!form.name.trim()) {
      setError('Please enter doctor name.')
      return
    }

    if (!form.specialization.trim()) {
      setError(
        'Please enter specialization.'
      )
      return
    }

    if (!form.qualification.trim()) {
      setError(
        'Please enter qualification.'
      )
      return
    }

    if (!form.hospital.trim()) {
      setError('Please enter hospital.')
      return
    }

    if (!form.location.trim()) {
      setError('Please enter location.')
      return
    }

    try {
      setSaving(true)

      const doctorData = {
        name: form.name.trim(),

        specialization:
          form.specialization.trim(),

        qualification:
          form.qualification.trim(),

        experience_years:
          form.experience_years === ''
            ? 0
            : Number(form.experience_years),

        hospital:
          form.hospital.trim(),

        location:
          form.location.trim(),

        phone:
          form.phone.trim(),

        email:
          form.email.trim(),

        consultation_fee:
          form.consultation_fee === ''
            ? 0
            : Number(form.consultation_fee),

        available:
          Boolean(form.available)
      }

      if (editingDoctor) {
        const { error } =
          await supabase
            .from('doctors')
            .update(doctorData)
            .eq(
              'id',
              editingDoctor.id
            )

        if (error) {
          throw error
        }

        setMessage(
          '✅ Doctor updated successfully.'
        )
      } else {
        const { error } =
          await supabase
            .from('doctors')
            .insert([doctorData])

        if (error) {
          throw error
        }

        setMessage(
          '✅ Doctor added successfully.'
        )
      }

      closeForm()

      await loadDoctors()
    } catch (err) {
      console.error(
        'Doctor save error:',
        err
      )

      setError(
        err.message ||
          'Unable to save doctor.'
      )
    } finally {
      setSaving(false)
    }
  }

  // =====================================================
  // DELETE DOCTOR
  // =====================================================

  const deleteDoctor = async (doctor) => {
    const confirmed =
      window.confirm(
        `Are you sure you want to delete ${doctor.name}?`
      )

    if (!confirmed) {
      return
    }

    try {
      setError('')
      setMessage('')

      const { error } =
        await supabase
          .from('doctors')
          .delete()
          .eq('id', doctor.id)

      if (error) {
        throw error
      }

      setMessage(
        '✅ Doctor deleted successfully.'
      )

      await loadDoctors()
    } catch (err) {
      console.error(
        'Doctor delete error:',
        err
      )

      setError(
        err.message ||
          'Unable to delete doctor.'
      )
    }
  }

  // =====================================================
  // ENABLE / DISABLE DOCTOR
  // =====================================================

  const toggleAvailability = async (doctor) => {
    try {
      setError('')
      setMessage('')

      const { error } =
        await supabase
          .from('doctors')
          .update({
            available:
              !doctor.available
          })
          .eq('id', doctor.id)

      if (error) {
        throw error
      }

      setMessage(
        '✅ Doctor availability updated.'
      )

      await loadDoctors()
    } catch (err) {
      console.error(
        'Availability update error:',
        err
      )

      setError(
        err.message ||
          'Unable to update availability.'
      )
    }
  }

  // =====================================================
  // UPDATE APPOINTMENT STATUS
  // =====================================================

  const updateAppointmentStatus =
    async (appointment, newStatus) => {
      try {
        setError('')
        setMessage('')

        const { error } =
          await supabase
            .from('appointments')
            .update({
              status: newStatus
            })
            .eq(
              'id',
              appointment.id
            )

        if (error) {
          throw error
        }

        setMessage(
          newStatus === 'confirmed'
            ? '✅ Appointment confirmed.'
            : '❌ Appointment cancelled.'
        )

        await loadAppointments()
      } catch (err) {
        console.error(
          'Appointment update error:',
          err
        )

        setError(
          err.message ||
            'Unable to update appointment.'
        )
      }
    }

  // =====================================================
  // FORMAT DATE
  // =====================================================

  const formatDate = (date) => {
    if (!date) {
      return ''
    }

    return new Date(
      `${date}T00:00:00`
    ).toLocaleDateString(
      undefined,
      {
        dateStyle: 'medium'
      }
    )
  }

  // =====================================================
  // FORMAT TIME
  // =====================================================

  const formatTime = (time) => {
    if (!time) {
      return ''
    }

    const [
      hours,
      minutes
    ] = time.split(':')

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
        minute: '2-digit'
      }
    )
  }

  // =====================================================
  // UI
  // =====================================================

  return (
    <div
      className="admin-panel"
      style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '30px'
      }}
    >

      {/* HEADER */}

      <div
        style={{
          textAlign: 'center',
          marginBottom: '30px'
        }}
      >

        <div
          style={{
            fontSize: '42px'
          }}
        >
          🩺
        </div>

        <div
          style={{
            color: '#008f83',
            fontWeight: '700',
            letterSpacing: '1px'
          }}
        >
          MEDISMART AI
        </div>

        <h1
          style={{
            fontSize: '42px',
            margin: '10px 0'
          }}
        >
          Admin Panel
        </h1>

        <p
          style={{
            fontSize: '18px',
            color: '#555'
          }}
        >
          Manage doctors and appointments.
        </p>

        {onBack && (
          <button
            onClick={onBack}
            style={{
              padding: '10px 18px',
              borderRadius: '8px',
              border: '1px solid #aaa',
              background: 'white',
              cursor: 'pointer'
            }}
          >
            ← Back to Dashboard
          </button>
        )}

      </div>


      {/* =================================================
          ADMIN STATISTICS
      ================================================= */}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '15px',
          marginBottom: '35px'
        }}
      >

        {/* TOTAL DOCTORS */}

        <div
          style={{
            background: 'white',
            padding: '20px',
            borderRadius: '12px',
            textAlign: 'center',
            boxShadow:
              '0 3px 12px rgba(0,0,0,0.08)'
          }}
        >
          <div
            style={{
              fontSize: '30px'
            }}
          >
            👨‍⚕️
          </div>

          <h2>{totalDoctors}</h2>

          <p>Total Doctors</p>
        </div>


        {/* TOTAL PATIENTS */}

        <div
          style={{
            background: 'white',
            padding: '20px',
            borderRadius: '12px',
            textAlign: 'center',
            boxShadow:
              '0 3px 12px rgba(0,0,0,0.08)'
          }}
        >
          <div
            style={{
              fontSize: '30px'
            }}
          >
            👥
          </div>

          <h2>{totalPatients}</h2>

          <p>Patients</p>
        </div>


        {/* TOTAL APPOINTMENTS */}

        <div
          style={{
            background: 'white',
            padding: '20px',
            borderRadius: '12px',
            textAlign: 'center',
            boxShadow:
              '0 3px 12px rgba(0,0,0,0.08)'
          }}
        >
          <div
            style={{
              fontSize: '30px'
            }}
          >
            📅
          </div>

          <h2>{totalAppointments}</h2>

          <p>Appointments</p>
        </div>


        {/* CONFIRMED */}

        <div
          style={{
            background: '#e8f8ef',
            padding: '20px',
            borderRadius: '12px',
            textAlign: 'center',
            boxShadow:
              '0 3px 12px rgba(0,0,0,0.08)'
          }}
        >
          <div
            style={{
              fontSize: '30px'
            }}
          >
            🟢
          </div>

          <h2>{confirmedAppointments}</h2>

          <p>Confirmed</p>
        </div>


        {/* PENDING */}

        <div
          style={{
            background: '#fff7df',
            padding: '20px',
            borderRadius: '12px',
            textAlign: 'center',
            boxShadow:
              '0 3px 12px rgba(0,0,0,0.08)'
          }}
        >
          <div
            style={{
              fontSize: '30px'
            }}
          >
            🟡
          </div>

          <h2>{pendingAppointments}</h2>

          <p>Pending</p>
        </div>


        {/* CANCELLED */}

        <div
          style={{
            background: '#fff0f0',
            padding: '20px',
            borderRadius: '12px',
            textAlign: 'center',
            boxShadow:
              '0 3px 12px rgba(0,0,0,0.08)'
          }}
        >
          <div
            style={{
              fontSize: '30px'
            }}
          >
            🔴
          </div>

          <h2>{cancelledAppointments}</h2>

          <p>Cancelled</p>
        </div>

      </div>


      {/* MESSAGES */}

      {message && (
        <div
          style={{
            background: '#e8f8ef',
            color: '#087f45',
            padding: '15px',
            borderRadius: '10px',
            marginBottom: '20px',
            textAlign: 'center'
          }}
        >
          {message}
        </div>
      )}


      {/* ERRORS */}

      {error && (
        <div
          style={{
            background: '#fff0f0',
            color: '#d22',
            padding: '15px',
            borderRadius: '10px',
            marginBottom: '20px',
            textAlign: 'center'
          }}
        >
          ⚠️ {error}
        </div>
      )}


      {/* =================================================
          DOCTORS
      ================================================= */}

      {!showForm && (
        <div
          style={{
            textAlign: 'center',
            marginBottom: '25px'
          }}
        >

          <button
            onClick={openAddForm}
            style={{
              padding: '14px 25px',
              borderRadius: '8px',
              border: 'none',
              background: '#008f83',
              color: 'white',
              fontSize: '17px',
              cursor: 'pointer',
              fontWeight: '600'
            }}
          >
            ➕ Add Doctor
          </button>

        </div>
      )}


      {/* ADD / EDIT FORM */}

      {showForm && (

        <div
          style={{
            background: 'white',
            padding: '25px',
            borderRadius: '15px',
            marginBottom: '30px',
            boxShadow:
              '0 3px 15px rgba(0,0,0,0.08)'
          }}
        >

          <h2>
            {editingDoctor
              ? '✏️ Edit Doctor'
              : '➕ Add Doctor'}
          </h2>

          <form onSubmit={handleSubmit}>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '15px'
              }}
            >

              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="Doctor Name"
              />

              <input
                name="specialization"
                value={form.specialization}
                onChange={handleChange}
                placeholder="Specialization"
              />

              <input
                name="qualification"
                value={form.qualification}
                onChange={handleChange}
                placeholder="Qualification"
              />

              <input
                type="number"
                min="0"
                name="experience_years"
                value={form.experience_years}
                onChange={handleChange}
                placeholder="Experience"
              />

              <input
                name="hospital"
                value={form.hospital}
                onChange={handleChange}
                placeholder="Hospital"
              />

              <input
                name="location"
                value={form.location}
                onChange={handleChange}
                placeholder="Location"
              />

              <input
                name="phone"
                value={form.phone}
                onChange={handleChange}
                placeholder="Phone"
              />

              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="Email"
              />

              <input
                type="number"
                min="0"
                step="0.01"
                name="consultation_fee"
                value={form.consultation_fee}
                onChange={handleChange}
                placeholder="Consultation Fee"
              />

            </div>


            <label
              style={{
                display: 'flex',
                gap: '10px',
                marginTop: '20px'
              }}
            >

              <input
                type="checkbox"
                name="available"
                checked={form.available}
                onChange={handleChange}
              />

              Doctor Available

            </label>


            <div
              style={{
                display: 'flex',
                gap: '10px',
                marginTop: '20px'
              }}
            >

              <button
                type="submit"
                disabled={saving}
                style={{
                  padding: '12px 22px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#008f83',
                  color: 'white',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                {saving
                  ? 'Saving...'
                  : editingDoctor
                    ? '💾 Update Doctor'
                    : '➕ Add Doctor'}
              </button>


              <button
                type="button"
                onClick={closeForm}
                style={{
                  padding: '12px 22px',
                  borderRadius: '8px',
                  border: '1px solid #aaa',
                  background: 'white',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>

            </div>

          </form>

        </div>
      )}


      {/* =================================================
          DOCTOR LIST
      ================================================= */}

      <div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px'
          }}
        >

          <h2>
            👨‍⚕️ Doctors ({doctors.length})
          </h2>

          <button
            onClick={loadDoctors}
            style={{
              padding: '10px 16px',
              borderRadius: '8px',
              border: '1px solid #aaa',
              background: 'white',
              cursor: 'pointer'
            }}
          >
            🔄 Refresh
          </button>

        </div>


        {loading ? (

          <div
            style={{
              textAlign: 'center',
              padding: '40px'
            }}
          >
            Loading doctors...
          </div>

        ) : (

          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '20px'
            }}
          >

            {doctors.map(
              (doctor) => (

                <div
                  key={doctor.id}
                  style={{
                    background: 'white',
                    padding: '22px',
                    borderRadius: '15px',
                    boxShadow:
                      '0 3px 12px rgba(0,0,0,0.08)'
                  }}
                >

                  <div
                    style={{
                      fontSize: '35px',
                      textAlign: 'center'
                    }}
                  >
                    👨‍⚕️
                  </div>

                  <h3
                    style={{
                      textAlign: 'center'
                    }}
                  >
                    {doctor.name}
                  </h3>

                  <p>
                    <strong>
                      Specialization:
                    </strong>{' '}
                    {doctor.specialization}
                  </p>

                  <p>
                    🎓 <strong>
                      Qualification:
                    </strong>{' '}
                    {doctor.qualification}
                  </p>

                  <p>
                    💼 <strong>
                      Experience:
                    </strong>{' '}
                    {doctor.experience_years ?? 0}
                    {' '}years
                  </p>

                  <p>
                    🏥 <strong>
                      Hospital:
                    </strong>{' '}
                    {doctor.hospital}
                  </p>

                  <p>
                    📍 <strong>
                      Location:
                    </strong>{' '}
                    {doctor.location}
                  </p>

                  <p>
                    💰 <strong>
                      Fee:
                    </strong>{' '}
                    ₹{doctor.consultation_fee}
                  </p>

                  <p>
                    📞 <strong>
                      Phone:
                    </strong>{' '}
                    {doctor.phone}
                  </p>

                  <p>
                    ✉️ <strong>
                      Email:
                    </strong>{' '}
                    {doctor.email}
                  </p>


                  <div
                    style={{
                      textAlign: 'center',
                      margin: '15px 0'
                    }}
                  >

                    <span
                      style={{
                        padding: '7px 14px',
                        borderRadius: '20px',
                        background:
                          doctor.available
                            ? '#dff7e9'
                            : '#ffe5e5',
                        color:
                          doctor.available
                            ? '#087f45'
                            : '#c62828'
                      }}
                    >
                      {doctor.available
                        ? '🟢 Available'
                        : '🔴 Unavailable'}
                    </span>

                  </div>


                  <div
                    style={{
                      display: 'flex',
                      gap: '8px',
                      flexWrap: 'wrap'
                    }}
                  >

                    <button
                      onClick={() =>
                        openEditForm(doctor)
                      }
                      style={{
                        flex: 1,
                        padding: '10px',
                        border: 'none',
                        background:
                          '#e8f1ff',
                        cursor: 'pointer'
                      }}
                    >
                      ✏️ Edit
                    </button>


                    <button
                      onClick={() =>
                        toggleAvailability(doctor)
                      }
                      style={{
                        flex: 1,
                        padding: '10px',
                        border: 'none',
                        background:
                          '#fff5d9',
                        cursor: 'pointer'
                      }}
                    >
                      {doctor.available
                        ? '⛔ Disable'
                        : '✅ Enable'}
                    </button>


                    <button
                      onClick={() =>
                        deleteDoctor(doctor)
                      }
                      style={{
                        width: '100%',
                        padding: '10px',
                        color: '#d22',
                        background: 'white',
                        border:
                          '1px solid #ffb3b3',
                        cursor: 'pointer'
                      }}
                    >
                      🗑️ Delete Doctor
                    </button>

                  </div>

                </div>

              )
            )}

          </div>

        )}

      </div>


      {/* =================================================
          APPOINTMENT MANAGEMENT
      ================================================= */}

      <div
        style={{
          marginTop: '50px'
        }}
      >

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px'
          }}
        >

          <h2>
            📅 Appointments ({appointments.length})
          </h2>

          <button
            onClick={loadAppointments}
            style={{
              padding: '10px 16px',
              borderRadius: '8px',
              border: '1px solid #aaa',
              background: 'white',
              cursor: 'pointer'
            }}
          >
            🔄 Refresh
          </button>

        </div>


        {appointmentsLoading ? (

          <div
            style={{
              textAlign: 'center',
              padding: '40px'
            }}
          >
            Loading appointments...
          </div>

        ) : appointments.length === 0 ? (

          <div
            style={{
              background: 'white',
              padding: '35px',
              borderRadius: '15px',
              textAlign: 'center'
            }}
          >
            No appointments found.
          </div>

        ) : (

          <div
            style={{
              display: 'grid',
              gap: '18px'
            }}
          >

            {appointments.map(
              (appointment) => {

                const doctor =
                  appointment.doctors

                return (

                  <div
                    key={appointment.id}
                    style={{
                      background: 'white',
                      padding: '22px',
                      borderRadius: '15px',
                      boxShadow:
                        '0 3px 12px rgba(0,0,0,0.08)'
                    }}
                  >

                    <h3>
                      👨‍⚕️{' '}
                      {doctor?.name ||
                        'Doctor'}
                    </h3>

                    <p>
                      <strong>
                        Specialization:
                      </strong>{' '}
                      {doctor?.specialization ||
                        'N/A'}
                    </p>

                    <p>
                      <strong>
                        Patient ID:
                      </strong>{' '}
                      {appointment.patient_id}
                    </p>

                    <p>
                      📅 <strong>
                        Date:
                      </strong>{' '}
                      {formatDate(
                        appointment.appointment_date
                      )}
                    </p>

                    <p>
                      🕐 <strong>
                        Time:
                      </strong>{' '}
                      {formatTime(
                        appointment.appointment_time
                      )}
                    </p>

                    <p>
                      📝 <strong>
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
                          color:
                            appointment.status ===
                            'confirmed'
                              ? '#087f45'
                              : appointment.status ===
                                'cancelled'
                                ? '#d22'
                                : '#b77900'
                        }}
                      >
                        {appointment.status}
                      </span>

                    </p>


                    {/* PENDING ACTIONS */}

                    {appointment.status ===
                      'pending' && (

                      <div
                        style={{
                          display: 'flex',
                          gap: '10px',
                          marginTop: '15px'
                        }}
                      >

                        <button
                          onClick={() =>
                            updateAppointmentStatus(
                              appointment,
                              'confirmed'
                            )
                          }
                          style={{
                            flex: 1,
                            padding: '12px',
                            border: 'none',
                            borderRadius: '8px',
                            background:
                              '#dff7e9',
                            color:
                              '#087f45',
                            cursor:
                              'pointer',
                            fontWeight:
                              '600'
                          }}
                        >
                          ✅ Confirm
                        </button>


                        <button
                          onClick={() =>
                            updateAppointmentStatus(
                              appointment,
                              'cancelled'
                            )
                          }
                          style={{
                            flex: 1,
                            padding: '12px',
                            border: 'none',
                            borderRadius: '8px',
                            background:
                              '#ffe5e5',
                            color: '#d22',
                            cursor:
                              'pointer',
                            fontWeight:
                              '600'
                          }}
                        >
                          ❌ Cancel
                        </button>

                      </div>

                    )}


                    {/* CONFIRMED */}

                    {appointment.status ===
                      'confirmed' && (

                      <div
                        style={{
                          marginTop: '15px',
                          padding: '10px',
                          background:
                            '#e8f8ef',
                          color:
                            '#087f45',
                          borderRadius:
                            '8px',
                          textAlign:
                            'center',
                          fontWeight:
                            '600'
                        }}
                      >
                        🟢 Appointment Confirmed
                      </div>

                    )}


                    {/* CANCELLED */}

                    {appointment.status ===
                      'cancelled' && (

                      <div
                        style={{
                          marginTop: '15px',
                          padding: '10px',
                          background:
                            '#fff0f0',
                          color: '#d22',
                          borderRadius:
                            '8px',
                          textAlign:
                            'center',
                          fontWeight:
                            '600'
                        }}
                      >
                        🔴 Appointment Cancelled
                      </div>

                    )}

                  </div>

                )
              }
            )}

          </div>

        )}

      </div>

    </div>
  )
}

export default AdminPanel