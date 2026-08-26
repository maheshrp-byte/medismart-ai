import { useEffect, useState } from 'react'
import { supabase } from './lib/supabaseClient'
import './App.css'
import MedicalReports from './MedicalReports'
import FindDoctor from './FindDoctor.jsx'
import Appointment from './Appointment.jsx'
import DoctorAppointments from "./DoctorAppointments.jsx";
import AdminPanel from './AdminPanel'

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isRegistering, setIsRegistering] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-card">
          <div className="logo-circle">+</div>
          <h2>MediSmart AI</h2>
          <p>Loading your healthcare assistant...</p>
        </div>
      </div>
    )
  }

  if (session) {
    return <Dashboard session={session} />
  }

  return (
    <AuthPage
      isRegistering={isRegistering}
      setIsRegistering={setIsRegistering}
    />
  )
}

export default App


/* =====================================================
   AUTH PAGE
===================================================== */

function AuthPage({ isRegistering, setIsRegistering }) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()

    setError('')
    setMessage('')

    if (!email || !password) {
      setError('Please enter your email and password.')
      return
    }

    if (isRegistering) {
      if (!fullName.trim()) {
        setError('Please enter your full name.')
        return
      }

      if (password.length < 6) {
        setError('Password must contain at least 6 characters.')
        return
      }

      if (password !== confirmPassword) {
        setError('Passwords do not match.')
        return
      }
    }

    setLoading(true)

    try {
      if (isRegistering) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
            },
          },
        })

        if (error) {
          setError(error.message)
        } else {
          setMessage(
            'Registration successful! Check your email to confirm your account.'
          )

          setFullName('')
          setEmail('')
          setPassword('')
          setConfirmPassword('')
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (error) {
          setError(error.message)
        }
      }
    } catch (err) {
      console.error(err)
      setError('Something went wrong. Please try again.')
    }

    setLoading(false)
  }

  return (
    <div className="auth-page">

      <div className="auth-left">

        <div className="brand">
          <div className="brand-icon">+</div>
          <span>MediSmart AI</span>
        </div>

        <div className="hero-content">

          <span className="badge">
            AI-POWERED HEALTHCARE
          </span>

          <h1>
            Your health.
            <br />
            <span>Smarter.</span>
          </h1>

          <p>
            An intelligent healthcare assistant that helps you understand
            your symptoms, medical reports, appointments and health information.
          </p>

          <div className="feature-list">

            <div className="feature-item">
              <div className="feature-icon">🤖</div>

              <div>
                <strong>AI Health Assistant</strong>
                <p>Get intelligent health information anytime.</p>
              </div>
            </div>

            <div className="feature-item">
              <div className="feature-icon">📄</div>

              <div>
                <strong>Medical Reports</strong>
                <p>
                  Understand your reports with AI-powered summaries.
                </p>
              </div>
            </div>

            <div className="feature-item">
              <div className="feature-icon">👨‍⚕️</div>

              <div>
                <strong>Find Doctors</strong>
                <p>
                  Discover doctors based on your healthcare needs.
                </p>
              </div>
            </div>

            <div className="feature-item">
              <div className="feature-icon">📅</div>

              <div>
                <strong>Appointments</strong>
                <p>
                  Book and manage doctor appointments easily.
                </p>
              </div>
            </div>

          </div>
        </div>

        <div className="medical-disclaimer">
          MediSmart AI provides health information and does not replace
          professional medical advice.
        </div>

      </div>


      <div className="auth-right">

        <div className="auth-card">

          <div className="mobile-brand">
            <div className="brand-icon">+</div>
            <span>MediSmart AI</span>
          </div>

          <div className="auth-heading">

            <h2>
              {isRegistering
                ? 'Create your account'
                : 'Welcome back'}
            </h2>

            <p>
              {isRegistering
                ? 'Start your smarter healthcare journey.'
                : 'Sign in to continue to your health dashboard.'}
            </p>

          </div>

          {error && (
            <div className="alert error">
              ⚠️ {error}
            </div>
          )}

          {message && (
            <div className="alert success">
              ✅ {message}
            </div>
          )}

          <form onSubmit={handleSubmit}>

            {isRegistering && (
              <div className="input-group">

                <label>Full Name</label>

                <input
                  type="text"
                  placeholder="Enter your full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />

              </div>
            )}

            <div className="input-group">

              <label>Email Address</label>

              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />

            </div>

            <div className="input-group">

              <label>Password</label>

              <input
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />

            </div>

            {isRegistering && (
              <div className="input-group">

                <label>Confirm Password</label>

                <input
                  type="password"
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChange={(e) =>
                    setConfirmPassword(e.target.value)
                  }
                />

              </div>
            )}

            <button
              className="primary-button"
              type="submit"
              disabled={loading}
            >
              {loading
                ? 'Please wait...'
                : isRegistering
                  ? 'Create Account'
                  : 'Sign In'}
            </button>

          </form>

          <div className="auth-switch">

            {isRegistering
              ? 'Already have an account?'
              : "Don't have an account?"}

            <button
              type="button"
              onClick={() => {
                setIsRegistering(!isRegistering)
                setError('')
                setMessage('')
              }}
            >
              {isRegistering
                ? 'Sign In'
                : 'Create Account'}
            </button>

          </div>

          <div className="security-note">
            🔐 Your account information is protected using
            Supabase authentication and database security.
          </div>

        </div>

      </div>

    </div>
  )
}


/* =====================================================
   DASHBOARD
===================================================== */

function Dashboard({ session }) {

  const userName =
    session.user.user_metadata?.full_name ||
    session.user.email?.split('@')[0] ||
    'Patient'

  const [activeFeature, setActiveFeature] = useState('home')

  const [selectedDoctor, setSelectedDoctor] = useState(null)

  // Load the current user's role from the profiles table.
  // Only users with role = "admin" can see/access the Admin Panel.
  const [userRole, setUserRole] = useState('patient')
  const [roleLoading, setRoleLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    const loadUserRole = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single()

        if (error) {
          console.error('Role loading error:', error)
          if (mounted) setUserRole('patient')
        } else {
          if (mounted) {
            setUserRole(data?.role === 'admin' ? 'admin' : 'patient')
          }
        }
      } catch (err) {
        console.error('Unable to load user role:', err)
        if (mounted) setUserRole('patient')
      } finally {
        if (mounted) setRoleLoading(false)
      }
    }

    loadUserRole()

    return () => {
      mounted = false
    }
  }, [session.user.id])

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  const openAppointment = (doctor) => {
    setSelectedDoctor(doctor)
    setActiveFeature('appointment')
  }

  const backToDoctors = () => {
    setSelectedDoctor(null)
    setActiveFeature('doctors')
  }

  return (
    <div className="dashboard">

      {/* HEADER */}

      <header className="dashboard-header">

        <div className="dashboard-brand">

          <div className="brand-icon">
            +
          </div>

          <span>
            MediSmart AI
          </span>

        </div>

        <div className="user-area">

          <div className="user-info">

            <strong>
              {userName}
            </strong>

            <span>
              {session.user.email}
            </span>

          </div>

          <button
            className="logout-button"
            onClick={handleLogout}
          >
            Logout
          </button>

        </div>

      </header>


      <main className="dashboard-content">

        {/* HOME */}

        {activeFeature === 'home' && (
          <>

            <section className="welcome-section">

              <div>

                <span className="dashboard-label">
                  PATIENT DASHBOARD
                </span>

                <h1>
                  Good to see you, {userName}! 👋
                </h1>

                <p>
                  Your intelligent healthcare assistant is ready.
                </p>

              </div>

            </section>


            <section className="dashboard-grid">

              <DashboardCard
                icon="🤖"
                title="AI Health Assistant"
                description="Analyze your symptoms and get general health information."
                color="purple"
                onClick={() =>
                  setActiveFeature('ai')
                }
              />

              <DashboardCard
                icon="📄"
                title="Medical Reports"
                description="Upload and understand your medical reports using AI."
                color="blue"
                onClick={() =>
                  setActiveFeature('reports')
                }
              />

              <DashboardCard
                icon="👨‍⚕️"
                title="Find a Doctor"
                description="Find doctors based on specialization and availability."
                color="green"
                onClick={() =>
                  setActiveFeature('doctors')
                }
              />

              <DashboardCard
                icon="📅"
                title="Appointments"
                description="Manage your upcoming healthcare appointments."
                color="orange"
                onClick={() =>
                  setActiveFeature('appointments')
                }
              />

              <DashboardCard
                icon="📋"
                title="Health History"
                description="View your previous symptom analyses and AI health information."
                color="purple"
                onClick={() =>
                  setActiveFeature('history')
                }
              />
              {!roleLoading && userRole === 'admin' && (
                <DashboardCard
                  icon="🩺"
                  title="Admin Panel"
                  description="Manage doctors, appointments and healthcare records."
                  color="green"
                  onClick={() => setActiveFeature('admin')}
                />
              )}

            </section>


            <section className="coming-soon">

              <div className="coming-icon">
                🚀
              </div>

              <div>

                <h2>
                  Your Smart Healthcare Journey
                </h2>

                <p>
                  Start with our AI Health Assistant and explore
                  smarter healthcare tools.
                </p>

              </div>

            </section>


            <div className="dashboard-disclaimer">

              <strong>
                Medical Disclaimer:
              </strong>{' '}

              MediSmart AI is an educational and informational
              tool. It does not provide medical diagnosis,
              treatment or emergency medical services.
              Always consult a qualified healthcare professional
              for medical decisions.

            </div>

          </>
        )}


        {/* AI ASSISTANT */}

        {activeFeature === 'ai' && (
          <AIHealthAssistant
            onBack={() =>
              setActiveFeature('home')
            }
          />
        )}


        {/* HEALTH HISTORY */}

        {activeFeature === 'history' && (
          <HealthHistory
            session={session}
            onBack={() =>
              setActiveFeature('home')
            }
          />
        )}


        {/* MEDICAL REPORTS */}

        {activeFeature === 'reports' && (
          <MedicalReports />
        )}
{/* =====================================
         ADMIN PANEL
====================================== */}

{activeFeature === 'admin' && (
  userRole === 'admin' ? (
    <AdminPanel
      onBack={() => setActiveFeature('home')}
    />
  ) : (
    <section className="health-history">

      <button
        className="back-button"
        onClick={() => setActiveFeature('home')}
      >
        ← Back to Dashboard
      </button>

      <div className="ai-error">
        ⚠️ You are not authorized to access the Admin Panel.
      </div>

    </section>
  )
)}

        {/* FIND DOCTOR */}

        {activeFeature === 'doctors' && (
          <FindDoctor
            onBookAppointment={openAppointment}
          />
        )}


        {/* APPOINTMENT BOOKING */}

        {activeFeature === 'appointment' && (
          <Appointment
            doctor={selectedDoctor}
            onBack={backToDoctors}
          />
        )}


        {/* APPOINTMENTS */}

        {activeFeature === 'appointments' && (
          <Appointments
            session={session}
            onBack={() =>
              setActiveFeature('home')
            }
            onFindDoctor={() =>
              setActiveFeature('doctors')
            }
          />
        )}

      </main>

    </div>
  )
}


/* =====================================================
   AI HEALTH ASSISTANT
===================================================== */

function AIHealthAssistant({ onBack }) {

  const [symptoms, setSymptoms] = useState('')
  const [response, setResponse] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const analyzeSymptoms = async () => {

    setError('')
    setResponse('')

    if (!symptoms.trim()) {
      setError(
        'Please describe your symptoms first.'
      )
      return
    }

    if (symptoms.trim().length < 5) {
      setError(
        'Please provide a little more information.'
      )
      return
    }

    setLoading(true)

    try {

      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        throw new Error(
          'Your session has expired. Please log in again.'
        )
      }

      const { data, error } =
        await supabase.functions.invoke(
          'ai-health-assistant',
          {
            body: {
              symptoms: symptoms.trim(),
            },
          }
        )

      if (error) {
        console.error(
          'Function error:',
          error
        )

        throw new Error(
          error.message ||
          'Unable to contact the AI assistant.'
        )
      }

      if (data?.error) {
        throw new Error(data.error)
      }

      if (!data?.response) {
        throw new Error(
          'The AI assistant returned an empty response.'
        )
      }

      setResponse(data.response)

    } catch (err) {

      console.error(
        'AI Assistant error:',
        err
      )

      setError(
        err.message ||
        'Something went wrong. Please try again.'
      )

    }

    setLoading(false)
  }


  return (
    <section className="ai-assistant">

      <button
        className="back-button"
        onClick={onBack}
      >
        ← Back to Dashboard
      </button>


      <div className="ai-header">

        <div className="ai-icon-large">
          🤖
        </div>

        <div>

          <span className="dashboard-label">
            MEDISMART AI
          </span>

          <h1>
            AI Health Assistant
          </h1>

          <p>
            Describe your symptoms and get general
            health information powered by AI.
          </p>

        </div>

      </div>


      <div className="ai-disclaimer">

        ⚠️ This tool provides general health information
        only. It does not provide a medical diagnosis.
        For emergencies, contact emergency medical services.

      </div>


      <div className="symptom-card">

        <label>
          Describe your symptoms
        </label>

        <textarea
          value={symptoms}
          onChange={(e) =>
            setSymptoms(e.target.value)
          }
          placeholder="Example: I have a headache and mild fever since yesterday..."
          maxLength={3000}
          rows={7}
          disabled={loading}
        />

        <div className="character-count">
          {symptoms.length}/3000
        </div>


        {error && (
          <div className="ai-error">
            ⚠️ {error}
          </div>
        )}


        <button
          className="analyze-button"
          onClick={analyzeSymptoms}
          disabled={loading}
        >

          {loading ? (
            <>
              <span className="spinner"></span>
              Analyzing...
            </>
          ) : (
            <>
              ✨ Analyze Symptoms
            </>
          )}

        </button>

      </div>


      {response && (
        <div className="ai-result">

          <div className="result-header">

            <div className="result-icon">
              🤖
            </div>

            <div>

              <h2>
                AI Health Analysis
              </h2>

              <span>
                Generated by MediSmart AI
              </span>

            </div>

          </div>


          <div className="result-content">
            {response}
          </div>


          <div className="result-footer">

            <strong>
              Important:
            </strong>{' '}

            This AI-generated information is for
            educational purposes only and should not
            replace advice from a qualified healthcare
            professional.

          </div>

        </div>
      )}

    </section>
  )
}


/* =====================================================
   HEALTH HISTORY
===================================================== */

function HealthHistory({ session, onBack }) {

  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedAnalysis, setSelectedAnalysis] =
    useState(null)

  const loadHistory = async () => {

    setLoading(true)
    setError('')

    try {

      const userId = session.user.id

      const { data, error } = await supabase
        .from('symptom_analyses')
        .select(
          'id, symptoms, ai_response, created_at'
        )
        .eq('patient_id', userId)
        .order('created_at', {
          ascending: false,
        })

      if (error) {

        console.error(
          'History loading error:',
          error
        )

        throw new Error(
          error.message ||
          'Unable to load your health history.'
        )
      }

      setHistory(data || [])

    } catch (err) {

      console.error(
        'Health history error:',
        err
      )

      setError(
        err.message ||
        'Something went wrong while loading history.'
      )

    }

    setLoading(false)
  }


  useEffect(() => {
    loadHistory()
  }, [])


  const formatDate = (dateString) => {

    if (!dateString) {
      return 'Unknown date'
    }

    return new Date(
      dateString
    ).toLocaleString(
      undefined,
      {
        dateStyle: 'medium',
        timeStyle: 'short',
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
          📋
        </div>

        <div>

          <span className="dashboard-label">
            MEDISMART AI
          </span>

          <h1>
            Health History
          </h1>

          <p>
            Review your previous symptom analyses
            and AI-generated health information.
          </p>

        </div>

      </div>


      <div className="ai-disclaimer">

        ⚠️ Your health history contains AI-generated
        informational content. It is not a medical diagnosis
        and should not replace professional medical advice.

      </div>


      <div className="history-toolbar">

        <div>

          <strong>
            {history.length}
          </strong>{' '}

          {history.length === 1
            ? 'analysis'
            : 'analyses'} found

        </div>


        <button
          className="history-refresh-button"
          onClick={loadHistory}
          disabled={loading}
        >
          🔄 {loading ? 'Loading...' : 'Refresh'}
        </button>

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
            Loading your history...
          </h2>

          <p>
            Please wait while we retrieve your
            previous health analyses.
          </p>

        </div>
      )}


      {!loading &&
        !error &&
        history.length === 0 && (

          <div className="history-empty">

            <div className="history-loading-icon">
              📋
            </div>

            <h2>
              No health history yet
            </h2>

            <p>
              Your symptom analyses will appear here
              after you use the AI Health Assistant.
            </p>

          </div>
        )}


      {!loading &&
        history.length > 0 && (

          <div className="history-list">

            {history.map((item) => (

              <div
                className="history-card"
                key={item.id}
              >

                <div className="history-card-top">

                  <div className="history-card-icon">
                    🤖
                  </div>

                  <div className="history-card-info">

                    <span className="history-date">
                      {formatDate(
                        item.created_at
                      )}
                    </span>

                    <h3>
                      Symptom Analysis
                    </h3>

                  </div>

                </div>


                <div className="history-symptoms">

                  <strong>
                    Symptoms
                  </strong>

                  <p>
                    {item.symptoms}
                  </p>

                </div>


                <button
                  className="history-view-button"
                  onClick={() =>
                    setSelectedAnalysis(item)
                  }
                >
                  View Full Analysis →
                </button>

              </div>

            ))}

          </div>
        )}


      {selectedAnalysis && (

        <div className="history-modal-overlay">

          <div className="history-modal">

            <div className="history-modal-header">

              <div>

                <span className="dashboard-label">
                  MEDISMART AI
                </span>

                <h2>
                  AI Health Analysis
                </h2>

                <span className="history-date">
                  {formatDate(
                    selectedAnalysis.created_at
                  )}
                </span>

              </div>


              <button
                className="history-close-button"
                onClick={() =>
                  setSelectedAnalysis(null)
                }
              >
                ✕
              </button>

            </div>


            <div className="history-modal-section">

              <h3>
                🩺 Symptoms
              </h3>

              <div className="history-symptoms-full">
                {selectedAnalysis.symptoms}
              </div>

            </div>


            <div className="history-modal-section">

              <h3>
                🤖 AI Analysis
              </h3>

              <div className="history-ai-response">
                {selectedAnalysis.ai_response}
              </div>

            </div>


            <div className="result-footer">

              <strong>
                Important:
              </strong>{' '}

              This AI-generated information is for
              educational purposes only and should not
              replace advice from a qualified healthcare
              professional.

            </div>


            <button
              className="history-close-main-button"
              onClick={() =>
                setSelectedAnalysis(null)
              }
            >
              Close Analysis
            </button>

          </div>

        </div>

      )}

    </section>
  )
}


/* =====================================================
   APPOINTMENTS
===================================================== */

function Appointments({ session, onBack, onFindDoctor }) {

  const [appointments, setAppointments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadAppointments = async () => {

    setLoading(true)
    setError('')

    try {

      const { data, error } = await supabase
        .from('appointments')
        .select(`
          id,
          appointment_date,
          appointment_time,
          reason,
          status,
          created_at,
          doctors (
            name,
            specialization,
            hospital,
            location,
            consultation_fee
          )
        `)
        .eq('patient_id', session.user.id)
        .order('appointment_date', {
          ascending: true,
        })

      if (error) {
        throw error
      }

      setAppointments(data || [])

    } catch (err) {

      console.error(
        'Appointments loading error:',
        err
      )

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


  const cancelAppointment = async (id) => {

    const confirmed = window.confirm(
      'Are you sure you want to cancel this appointment?'
    )

    if (!confirmed) {
      return
    }

    try {

      const { error } = await supabase
        .from('appointments')
        .update({
          status: 'cancelled',
        })
        .eq('id', id)
        .eq('patient_id', session.user.id)

      if (error) {
        throw error
      }

      loadAppointments()

    } catch (err) {

      console.error(err)

      setError(
        err.message ||
        'Unable to cancel appointment.'
      )
    }
  }


  const formatDate = (date) => {
    if (!date) return ''

    return new Date(
      `${date}T00:00:00`
    ).toLocaleDateString(
      undefined,
      {
        dateStyle: 'medium',
      }
    )
  }


  const formatTime = (time) => {

    if (!time) return ''

    const [hours, minutes] =
      time.split(':')

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
          📅
        </div>

        <div>

          <span className="dashboard-label">
            MEDISMART AI
          </span>

          <h1>
            My Appointments
          </h1>

          <p>
            View and manage your doctor appointments.
          </p>

        </div>

      </div>


      {error && (
        <div className="ai-error">
          ⚠️ {error}
        </div>
      )}


      <div
        style={{
          display: 'flex',
          gap: '10px',
          marginBottom: '25px',
          flexWrap: 'wrap',
        }}
      >

        <button
          className="history-refresh-button"
          onClick={loadAppointments}
          disabled={loading}
        >
          🔄 {loading ? 'Loading...' : 'Refresh'}
        </button>

        <button
          className="history-refresh-button"
          onClick={onFindDoctor}
        >
          👨‍⚕️ Find a Doctor
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
              No appointments yet
            </h2>

            <p>
              Find a doctor and book your first appointment.
            </p>

            <button
              className="primary-button"
              onClick={onFindDoctor}
            >
              👨‍⚕️ Find a Doctor
            </button>

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
                        Time:
                      </strong>{' '}
                      {formatTime(
                        appointment.appointment_time
                      )}
                    </p>

                    {appointment.reason && (
                      <p>
                        <strong>
                          Reason:
                        </strong>{' '}
                        {appointment.reason}
                      </p>
                    )}

                    <p>
                      <strong>
                        Status:
                      </strong>{' '}
                      {appointment.status}
                    </p>

                  </div>


                  {appointment.status !== 'cancelled' &&
                    appointment.status !== 'completed' && (

                    <button
                      className="history-close-main-button"
                      onClick={() =>
                        cancelAppointment(
                          appointment.id
                        )
                      }
                      style={{
                        background: '#fff',
                        color: '#d93025',
                        border: '1px solid #f1a5a5',
                      }}
                    >
                      Cancel Appointment
                    </button>

                  )}

                </div>
              )
            })}

          </div>
        )}

    </section>
  )
}


/* =====================================================
   DASHBOARD CARD
===================================================== */

function DashboardCard({
  icon,
  title,
  description,
  color,
  onClick,
}) {

  return (
    <div
      className={`dashboard-card ${color} ${
        onClick ? 'clickable' : ''
      }`}
      onClick={onClick}
    >

      <div className="card-icon">
        {icon}
      </div>

      <h3>
        {title}
      </h3>

      <p>
        {description}
      </p>

      <button
        className="card-button"
        onClick={(e) => {

          e.stopPropagation()

          if (onClick) {
            onClick()
          }

        }}
      >

        {onClick
          ? 'Open →'
          : 'Coming Soon →'}

      </button>

    </div>
  )
}