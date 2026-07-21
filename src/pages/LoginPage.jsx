import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { signIn } from '../lib/auth'
import { VENDOR, getChurch } from '../lib/supabase'
import { warmGeoLocation, getOrCreateDeviceId, checkDeviceRegistered, checkDeviceRegisteredByUser, saveDevice, tagLoginWithDevice } from '../lib/loginLogs'
import { fetchCompanionStatus } from '../lib/companion'
import { Eye, EyeOff, Loader2, CheckCircle2 } from 'lucide-react'

export default function LoginPage() {
  const { session, profile } = useAuth()
  const navigate    = useNavigate()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPw,   setShowPw]   = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [inputErr, setInputErr] = useState(false)
  const [status,   setStatus]   = useState('')   // '' | 'authenticating' | 'welcome'
  const [organization, setOrganization] = useState(null)

  const orbParticles = useMemo(() => {
    const palette = [
      { fill: 'rgba(59,130,246,0.85)',  glow: '0 0 14px 5px rgba(59,130,246,0.45)' },
      { fill: 'rgba(96,165,250,0.75)',  glow: '0 0 12px 4px rgba(96,165,250,0.40)' },
      { fill: 'rgba(34,211,238,0.75)',  glow: '0 0 16px 5px rgba(34,211,238,0.40)' },
      { fill: 'rgba(139,92,246,0.70)',  glow: '0 0 14px 5px rgba(139,92,246,0.38)' },
      { fill: 'rgba(224,242,254,0.65)', glow: '0 0 10px 3px rgba(255,255,255,0.30)' },
    ]
    return [...Array(45)].map((_, i) => {
      const c    = palette[Math.floor(Math.random() * palette.length)]
      const size = 3 + Math.random() * 11
      return {
        id: i,
        left:              `${Math.random() * 100}%`,
        width:             `${size}px`,
        height:            `${size}px`,
        animationDelay:    `${Math.random() * 18}s`,
        animationDuration: `${12 + Math.random() * 14}s`,
        background:        c.fill,
        boxShadow:         c.glow,
      }
    })
  }, [])

  const starParticles = useMemo(() =>
    [...Array(30)].map((_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      top:  `${Math.random() * 100}%`,
      width: `${1 + Math.random() * 2}px`,
      height: `${1 + Math.random() * 2}px`,
      animationDelay: `${Math.random() * 5}s`,
      animationDuration: `${2 + Math.random() * 3}s`
    })), []
  )

  useEffect(() => {
    if (session) navigate('/dashboard')  // already logged in — redirect immediately
    getChurch().then(setOrganization)
    warmGeoLocation()
  }, []) // eslint-disable-line

  const handleSubmit = async e => {
    e.preventDefault()
    setLoading(true)
    setStatus('authenticating')
    setError('')
    sessionStorage.setItem('login_welcome', '1')  // flag checked by PublicRoute to delay redirect

    try {
      const companion = await fetchCompanionStatus()
      const devId = companion?.deviceId || getOrCreateDeviceId()
      const knownByDevice = await checkDeviceRegistered(devId)
      const companionProfile = companion?.deviceProfile || null

      // Previously a device-setup popup was queued here for new devices.
      // That flow has been removed — device setup is optional and available
      // from the "Edit Device" action in the header.

      const deviceMeta = {
        deviceId:   devId,
        deviceName: knownByDevice?.user_name || companionProfile?.name || null,
        designation: knownByDevice?.designation || companionProfile?.designation || null,
        org:         knownByDevice?.org_name || companionProfile?.orgName || '',
        location:    knownByDevice?.location || companionProfile?.location || null,
      }

      const { error: err, data: authData } = await signIn(email.trim(), password, deviceMeta)

      if (err) {
        sessionStorage.removeItem('device_setup_pending')
        sessionStorage.removeItem('login_welcome')
        setError(err.message)
        setInputErr(true)
        setStatus('')
        setLoading(false)
      } else {
        setError('')
        setInputErr(false)
        setStatus('welcome')
        setLoading(false)
        const uid = authData?.user?.id

        // Device metadata updates should never break the login experience.
        void (async () => {
          try {
            if (knownByDevice) {
              await tagLoginWithDevice(uid, {
                deviceId:    devId,
                userName:    knownByDevice.user_name,
                location:    knownByDevice.location,
                org:         knownByDevice.org_name,
                designation: knownByDevice.designation || null,
              })
            } else {
              const knownByUser = await checkDeviceRegisteredByUser(uid)
              if (!knownByUser) {
                const profile = companion?.deviceProfile || null
                if (profile?.name && profile?.location) {
                  await saveDevice({
                    deviceId:    devId,
                    userId:      uid,
                    orgName:     profile?.orgName || '',
                    userName:    profile.name,
                    designation: profile.designation || null,
                    location:    profile.location,
                  })
                  await tagLoginWithDevice(uid, {
                    deviceId:    devId,
                    userName:    profile.name,
                    location:    profile.location,
                    org:         profile.orgName || '',
                    designation: profile.designation || null,
                  })
                }
              }
            }
          } catch (deviceError) {
            console.warn('Device registration/log tagging failed:', deviceError)
          }
        })()
      }
    } catch (ex) {
      sessionStorage.removeItem('device_setup_pending')
      sessionStorage.removeItem('login_welcome')
      setError('Login failed. Please try again.')
      setInputErr(true)
      setStatus('')
      setLoading(false)
    }
  }

  // Dynamic organization info
  const orgCity = organization?.city || ''
  const orgName = organization?.church_name || 'WORK MANAGEMENT SYSTEM'
  const orgAddress = organization?.address || ''
  const orgCityName = organization?.city || 'PONDICHERRY'

  const fullLocation = orgAddress && orgCityName
    ? `${orgAddress.toUpperCase()}, ${orgCityName.toUpperCase()}`
    : orgAddress.toUpperCase() || orgCityName.toUpperCase() || 'PONDICHERRY, INDIA'

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .login-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          font-family: 'Inter', sans-serif;
          background: #010409;
          position: relative;
          overflow: hidden;
        }

        /* Deep animated colour blobs */
        .animated-bg {
          position: absolute;
          inset: 0;
          background:
            radial-gradient(ellipse 60% 50% at 15% 20%, rgba(37,99,235,0.22) 0%, transparent 70%),
            radial-gradient(ellipse 50% 40% at 85% 80%, rgba(139,92,246,0.18) 0%, transparent 70%),
            radial-gradient(ellipse 70% 60% at 50% 50%, rgba(10,14,42,0.95)   0%, transparent 100%);
          animation: bgShift 10s ease-in-out infinite alternate;
        }
        @keyframes bgShift {
          0%   { opacity: 0.7; filter: hue-rotate(0deg);   transform: scale(1); }
          50%  { opacity: 1;   filter: hue-rotate(15deg);  transform: scale(1.08); }
          100% { opacity: 0.8; filter: hue-rotate(-10deg); transform: scale(1); }
        }

        /* Secondary blob that drifts independently */
        .bg-blob2 {
          position: absolute;
          inset: 0;
          background:
            radial-gradient(ellipse 45% 35% at 75% 25%, rgba(34,211,238,0.10) 0%, transparent 70%),
            radial-gradient(ellipse 55% 45% at 25% 75%, rgba(59,130,246,0.12)  0%, transparent 70%);
          animation: blobDrift 14s ease-in-out infinite alternate;
          pointer-events: none;
        }
        @keyframes blobDrift {
          0%   { transform: translate(0, 0)   scale(1); }
          50%  { transform: translate(4%, 3%) scale(1.06); }
          100% { transform: translate(-3%, 2%) scale(0.97); }
        }

        /* Sweeping light rays */
        .ray {
          position: absolute;
          top: -20%;
          width: 1.5px;
          height: 140%;
          background: linear-gradient(to bottom, transparent 0%, rgba(96,165,250,0.12) 40%, rgba(96,165,250,0.08) 60%, transparent 100%);
          transform-origin: top center;
          pointer-events: none;
        }
        .ray-1 { left: 25%; transform: rotate(-18deg); animation: raySweep 18s ease-in-out infinite; }
        .ray-2 { left: 55%; transform: rotate(12deg);  animation: raySweep 24s ease-in-out infinite reverse; opacity: 0.6; }
        .ray-3 { left: 75%; transform: rotate(-8deg);  animation: raySweep 20s ease-in-out infinite 4s; opacity: 0.4; }
        @keyframes raySweep {
          0%, 100% { opacity: 0; transform: rotate(var(--r, -18deg)) translateX(0px); }
          20%      { opacity: 1; }
          50%      { transform: rotate(var(--r, -18deg)) translateX(30px); opacity: 0.9; }
          80%      { opacity: 0.7; }
        }

        /* Aurora effect — enhanced */
        .aurora {
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: conic-gradient(from 180deg at 50% 50%,
            rgba(37,99,235,0.06)  0deg,
            rgba(139,92,246,0.10) 90deg,
            rgba(34,211,238,0.07) 180deg,
            rgba(37,99,235,0.06)  270deg,
            rgba(139,92,246,0.08) 360deg);
          animation: auroraMove 20s ease-in-out infinite;
          pointer-events: none;
        }
        @keyframes auroraMove {
          0%   { transform: translate(0%,   0%)  rotate(0deg);  opacity: 0.5; }
          33%  { transform: translate(4%,   3%)  rotate(3deg);  opacity: 0.9; }
          66%  { transform: translate(-3%,  5%)  rotate(-2deg); opacity: 0.6; }
          100% { transform: translate(0%,   0%)  rotate(0deg);  opacity: 0.5; }
        }

        /* Rising glowing orbs */
        .orb {
          position: absolute;
          top: 0;
          border-radius: 50%;
          pointer-events: none;
          animation: riseOrb linear infinite;
        }
        @keyframes riseOrb {
          0%   { transform: translateY(115vh) translateX(0px);   opacity: 0; }
          7%   { opacity: 1; }
          28%  { transform: translateY(82vh)  translateX(20px); }
          52%  { transform: translateY(50vh)  translateX(-16px); }
          76%  { transform: translateY(20vh)  translateX(14px); }
          93%  { opacity: 0.7; }
          100% { transform: translateY(-8vh)  translateX(0px);  opacity: 0; }
        }

        /* Stars */
        .star {
          position: absolute;
          background: white;
          border-radius: 50%;
          pointer-events: none;
          animation: twinkle 3s ease-in-out infinite;
        }
        @keyframes twinkle {
          0%, 100% { opacity: 0.2; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.3); }
        }

        .card-wrap { 
          position: relative; 
          z-index: 10; 
          width: 100%; 
          max-width: 460px;
          animation: cardAppear 0.5s cubic-bezier(0.2, 0.9, 0.4, 1.1);
        }
        @keyframes cardAppear {
          from { opacity: 0; transform: translateY(20px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        /* Card border */
        .card-border {
          position: absolute; inset: -1px; border-radius: 24px;
          background: linear-gradient(135deg, #3b82f6, #60a5fa, #2563eb);
          background-size: 200% 200%;
          animation: borderAnim 3s ease infinite;
          filter: blur(3px);
          opacity: 0.5;
        }
        @keyframes borderAnim {
          0%, 100% { background-position: 0% 50%; opacity: 0.3; }
          50% { background-position: 100% 50%; opacity: 0.6; }
        }

        .card {
          position: relative;
          background: linear-gradient(180deg, rgba(8,12,36,0.96) 0%, rgba(3,5,18,0.98) 100%);
          backdrop-filter: blur(2px);
          border-radius: 22px;
          padding: 20px 30px 18px;
          overflow: hidden;
          transition: all 0.3s ease;
          border: 1px solid rgba(59,130,246,0.2);
          box-shadow: 0 8px 32px rgba(0,0,0,0.4);
        }
        .card:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 45px rgba(0,0,0,0.5);
          border-color: rgba(59,130,246,0.3);
        }

        /* Verse - removed */
        .verse-top { display: none; }
        .verse-text { display: none; }
        .verse-ref { display: none;
        }

        /* Organization section */
        .org-section {
          display: flex;
          flex-direction: column;
          align-items: center;
          margin-bottom: 14px;
          width: 100%;
        }

        .org-header {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-bottom: 6px;
          width: 100%;
        }
        
        .org-icon {
          display: block;
          filter: drop-shadow(0 4px 12px rgba(59,130,246,0.4));
          transition: all 0.3s ease;
        }
        .org-icon:hover {
          filter: drop-shadow(0 6px 20px rgba(59,130,246,0.6));
          transform: scale(1.02);
        }
        
        .org-info {
          text-align: center;
          width: 100%;
        }
        
        .org-name {
          font-family: 'Sora', sans-serif;
          font-size: 20px;
          font-weight: 800;
          color: #ffffff;
          letter-spacing: 1.2px;
          line-height: 1.4;
          margin-bottom: 6px;
          text-transform: uppercase;
        }
        
        .org-location {
          font-size: 11px;
          font-weight: 600;
          color: #60a5fa;
          text-align: center;
          opacity: 0.9;
          letter-spacing: 0.4px;
          text-transform: uppercase;
        }

        /* Divider above CMS - removed */
        .cms-divider { display: none; }

        /* CMS LABEL - Golden effect only */
        .cms-section {
          margin-bottom: 14px;
          text-align: center;
        }
        .org-label {
          font-family: 'Sora', sans-serif;
          font-size: 16px;
          font-weight: 800;
          text-align: center;
          letter-spacing: 1.8px;
          text-transform: uppercase;
          background: linear-gradient(135deg, #ffd700, #daa520, #b8860b, #daa520, #ffd700);
          background-size: 300% auto;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: goldenShimmer 3s ease infinite;
          transition: all 0.3s ease;
          display: inline-block;
          padding: 0 6px;
        }
        .org-label:hover {
          letter-spacing: 2.5px;
          background: linear-gradient(135deg, #ffed4e, #ffd700, #ffed4e);
          background-size: 300% auto;
          -webkit-background-clip: text;
          background-clip: text;
        }
        @keyframes goldenShimmer {
          0% { background-position: 0% 50%; opacity: 0.9; }
          50% { background-position: 100% 50%; opacity: 1; }
          100% { background-position: 0% 50%; opacity: 0.9; }
        }

        /* Form inputs */
        .f-group { margin-bottom: 12px; }
        .f-label {
          display: block;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.15em;
          color: #60a5fa;
          margin-bottom: 8px;
        }
        .f-input {
          width: 100%;
          height: 48px;
          padding: 0 16px;
          background: rgba(4,6,20,0.85);
          border: 1px solid rgba(59,130,246,0.22);
          border-radius: 10px;
          font-size: 14px;
          color: #e2e8f0;
          font-family: inherit;
          outline: none;
          transition: all 0.2s ease;
        }
        .f-input::placeholder { color: #334155; }
        .f-input:focus {
          border-color: #3b82f6;
          background: rgba(4,6,20,1);
          box-shadow: 0 0 0 3px rgba(59,130,246,0.15);
        }

        .pw-wrap { position: relative; }
        .f-input-pw { padding-right: 46px; }
        .f-input-pw::-ms-reveal,
        .f-input-pw::-ms-clear { display: none; }
        input[type="password"]::-webkit-credentials-auto-fill-button,
        input[type="password"]::-webkit-contacts-auto-fill-button {
          display: none !important;
        }

        .eye-btn {
          position: absolute;
          right: 14px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          cursor: pointer;
          color: #475569;
          padding: 4px;
          display: flex;
          align-items: center;
          transition: all 0.2s ease;
          z-index: 2;
        }
        .eye-btn:hover { 
          color: #60a5fa; 
          transform: translateY(-50%) scale(1.05);
        }

        .f-error {
          background: rgba(239,68,68,0.1);
          border: 1px solid rgba(239,68,68,0.25);
          border-radius: 8px;
          padding: 10px 14px;
          font-size: 12px;
          color: #fca5a5;
          margin-bottom: 18px;
        }

        .btn-submit {
          width: 100%;
          height: 46px;
          background: linear-gradient(135deg, #2563eb, #1d4ed8);
          color: #fff;
          border: none;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 700;
          font-family: 'Sora', sans-serif;
          cursor: pointer;
          letter-spacing: 1px;
          box-shadow: 0 4px 14px rgba(37,99,235,0.4);
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-bottom: 18px;
        }
        .btn-submit:hover:not(:disabled) {
          background: linear-gradient(135deg, #3b82f6, #2563eb);
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(37,99,235,0.5);
        }
        .btn-submit:active:not(:disabled) { transform: translateY(1px); }
        .btn-submit:disabled { opacity: 0.55; cursor: not-allowed; }

        .footer { 
          text-align: center; 
          font-size: 10px; 
          color: #475569;
        }
        .footer strong { color: #60a5fa; font-weight: 600; }

        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 0.8s linear infinite; }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          15%       { transform: translateX(-7px); }
          30%       { transform: translateX(7px); }
          45%       { transform: translateX(-5px); }
          60%       { transform: translateX(5px); }
          75%       { transform: translateX(-3px); }
          90%       { transform: translateX(3px); }
        }
        .form-shake { animation: shake 0.5s ease; }

        .f-input-error {
          border-color: rgba(239,68,68,0.6) !important;
          box-shadow: 0 0 0 3px rgba(239,68,68,0.12) !important;
        }

        @keyframes btnPulse {
          0%, 100% { box-shadow: 0 4px 14px rgba(37,99,235,0.4); }
          50%       { box-shadow: 0 4px 22px rgba(59,130,246,0.7); }
        }
        .btn-submit:not(:disabled) { animation: btnPulse 2.5s ease-in-out infinite; }
        .btn-submit:hover:not(:disabled),
        .btn-submit:active:not(:disabled) { animation: none; }

        .forgot-link {
          display: block;
          text-align: right;
          font-size: 11px;
          color: #60a5fa;
          text-decoration: none;
          margin-top: -8px;
          margin-bottom: 16px;
          opacity: 0.75;
          transition: opacity 0.2s;
          cursor: pointer;
          background: none;
          border: none;
          font-family: inherit;
          padding: 0;
        }
        .forgot-link:hover { opacity: 1; text-decoration: underline; }

        /* Status overlay */
        .status-overlay {
          position: absolute;
          inset: 0;
          border-radius: 22px;
          background: rgba(3,5,18,0.95);
          backdrop-filter: blur(6px);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 20px;
          z-index: 30;
          animation: fadeIn 0.25s ease;
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }

        .status-ring {
          width: 56px; height: 56px;
          border: 3px solid rgba(59,130,246,0.15);
          border-top-color: #3b82f6;
          border-radius: 50%;
          animation: spin 0.85s linear infinite;
        }

        .status-check {
          color: #22c55e;
          filter: drop-shadow(0 0 10px rgba(34,197,94,0.5));
          animation: checkPop 0.4s cubic-bezier(0.2, 0.9, 0.4, 1.4) both;
        }
        @keyframes checkPop {
          from { opacity: 0; transform: scale(0.4); }
          to   { opacity: 1; transform: scale(1); }
        }

        .praise-label {
          font-family: 'Sora', sans-serif;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 2.5px;
          text-transform: uppercase;
          background: linear-gradient(135deg, #ffd700, #daa520, #ffd700);
          background-size: 200% auto;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: goldenShimmer 2s ease infinite;
          margin-bottom: 4px;
        }

        .status-msg {
          font-family: 'Sora', sans-serif;
          font-size: 17px;
          font-weight: 700;
          letter-spacing: 0.8px;
          color: #e2e8f0;
        }
        .status-msg.welcome { color: #86efac; }

        .welcome-name {
          font-family: 'Sora', sans-serif;
          font-size: 22px;
          font-weight: 800;
          color: #ffffff;
          letter-spacing: 0.5px;
          margin-top: 2px;
          text-align: center;
          max-width: 320px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .status-dots::after {
          content: '';
          animation: dots 1.4s steps(4, end) infinite;
        }
        @keyframes dots {
          0%   { content: ''; }
          25%  { content: '.'; }
          50%  { content: '..'; }
          75%, 100% { content: '...'; }
        }

        @media (max-width: 550px) {
          .card { padding: 16px 20px 16px; }
          .org-name { font-size: 18px; letter-spacing: 1px; }
          .org-location { font-size: 10px; }
          .org-label { font-size: 14px; letter-spacing: 1.5px; }
        }
      `}</style>

      <div className="login-page">
        <div className="animated-bg"/>
        <div className="bg-blob2"/>
        <div className="ray ray-1"/>
        <div className="ray ray-2"/>
        <div className="ray ray-3"/>
        <div className="aurora"/>

        {/* Rising glowing orbs */}
        {orbParticles.map(o => (
          <div
            key={o.id}
            className="orb"
            style={{
              left: o.left, width: o.width, height: o.height,
              background: o.background, boxShadow: o.boxShadow,
              animationDelay: o.animationDelay, animationDuration: o.animationDuration,
            }}
          />
        ))}

        {/* Stars - memoized */}
        {starParticles.map(s => (
          <div
            key={`star-${s.id}`}
            className="star"
            style={{
              left: s.left, top: s.top, width: s.width, height: s.height,
              animationDelay: s.animationDelay, animationDuration: s.animationDuration
            }}
          />
        ))}

        <div className="card-wrap">
          <div className="card-border"/>
          <div className="card">

            {/* Status overlay — shown during auth and on success */}
            {status && (
              <div className="status-overlay">
                {status === 'authenticating' ? (
                  <>
                    <div className="status-ring"/>
                    <p className="status-msg">Authenticating<span className="status-dots"/></p>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={52} className="status-check"/>
                    <p className="status-msg welcome">Welcome back!</p>
                    <p className="welcome-name">
                      {profile?.full_name || email.split('@')[0]}
                    </p>
                  </>
                )}
              </div>
            )}

            {/* Organization section */}
            <div className="org-section">
              <div className="org-header">
                <svg className="org-icon" width="55" height="52" viewBox="0 0 72 68" fill="none">
                  {/* Machine shop icon: gear, wrench, and tool head */}
                  <circle cx="36" cy="30" r="12" fill="none" stroke="#60a5fa" strokeWidth="2"/>
                  <path d="M36 18 L36 10 M36 50 L36 42 M24 30 L16 30 M56 30 L48 30 M28.5 23.5 L23 18 M48.5 23.5 L54 18 M28.5 36.5 L23 42 M48.5 36.5 L54 42" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round"/>
                  <circle cx="36" cy="30" r="5" fill="#0f1438" stroke="#3b82f6" strokeWidth="1.2"/>
                  <path d="M18 48 L54 22" stroke="#3b82f6" strokeWidth="4" strokeLinecap="round"/>
                  <path d="M16 50 L24 42" stroke="#3b82f6" strokeWidth="4" strokeLinecap="round"/>
                  <path d="M50 20 L58 12" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" opacity="0.9"/>
                  <path d="M22 46 L28 40" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" opacity="0.9"/>
                  <path d="M10 54 H62" stroke="#1e3a8a" strokeWidth="3" strokeLinecap="round" opacity="0.5"/>
                  <rect x="10" y="54" width="52" height="4" rx="2" fill="#0b1227"/>
                  <rect x="12" y="44" width="14" height="10" rx="2" fill="#0f1438" stroke="#3b82f6" strokeWidth="1"/>
                  <rect x="46" y="12" width="10" height="14" rx="2" fill="#0f1438" stroke="#3b82f6" strokeWidth="1"/>
                  <path d="M48 14 L56 14 L56 22" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round"/>
                  <path d="M18 50 C22 46, 26 46, 30 50" stroke="#60a5fa" strokeWidth="2" fill="none" opacity="0.7"/>
                </svg>

                <div className="org-info">
                  <p className="org-name">{orgName.toUpperCase()}</p>
                  <p className="org-location">{fullLocation}</p>
                </div>
              </div>
            </div>

            {/* Divider - removed */}

            {/* WMS label */}
            <div className="cms-section">
              <p className="org-label">WORK MANAGEMENT SYSTEM</p>
            </div>

            {/* Login Form */}
            <form onSubmit={handleSubmit} className={error ? 'form-shake' : ''} key={error}>
              <div className="f-group">
                <label className="f-label">EMAIL</label>
                <input
                  className={`f-input${inputErr ? ' f-input-error' : ''}`}
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setInputErr(false); setError(''); }}
                  required
                  autoFocus
                  autoComplete="username"
                />
              </div>

              <div className="f-group">
                <label className="f-label">PASSWORD</label>
                <div className="pw-wrap">
                  <input
                    className={`f-input f-input-pw${inputErr ? ' f-input-error' : ''}`}
                    type={showPw ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={password}
                    onChange={e => { setPassword(e.target.value); setInputErr(false); setError(''); }}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSubmit(e); } }}
                    required
                    autoComplete="current-password"
                  />
                  {password.length > 0 && (
                    <button
                      type="button"
                      className="eye-btn"
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => setShowPw(v => !v)}
                      tabIndex={-1}
                    >
                      {showPw ? <EyeOff size={16}/> : <Eye size={16}/>}
                    </button>
                  )}
                </div>
              </div>

              <button
                type="button"
                className="forgot-link"
                onClick={() => alert('Please contact your administrator to reset your password.')}
              >
                Forgot password?
              </button>

              {error && <div className="f-error">⚠ {error}</div>}

              <button
                className="btn-submit"
                type="submit"
                disabled={loading}
              >
                {loading
                  ? <><Loader2 size={16} className="spin"/> SIGNING IN...</>
                  : 'SIGN IN'
                }
              </button>
            </form>

            <div className="footer">
              Powered by <strong>{VENDOR.name}</strong>, {VENDOR.city}
            </div>

          </div>
        </div>
      </div>
    </>
  )
}