import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { setAuth } from "../utils/authStorage"
import loginBg from "../assets/login.png"
import aboutImg from "../assets/about.jpg"
import securityImg from "../assets/security.jpg"
import kpikraImg from "../assets/kpikra.jpg"
import dashboardImg from "../assets/dashboard.jpg"
import scoringImg from "../assets/scoreing.jpg"
import notificationImg from "../assets/notification.jpg"
import customImg from "../assets/custome.png"
import logoImg from "../assets/logo.png"
import { CheckCircle } from "lucide-react"
import whychoseImg from "../assets/whychose.png"

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginSuccess, setLoginSuccess] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isFlipping, setIsFlipping] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();

    try {
      const response = await fetch("http://localhost:3000/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (response.ok) {
        const data = await response.json();
        const userRole = (data.user.role || '').toLowerCase();
        
        // Set auth data in storage
        setAuth({
          token: data.access_token,
          role: userRole,
          userName: data.user.name,
          email: data.user.email,
        });

        // Force a full page reload to ensure all components re-render with new auth state
        setShowSuccess(true);
        
        setTimeout(() => {
          setIsFlipping(true);
          setTimeout(() => {
            // Force a full page reload to ensure all components re-render with new auth state
            window.location.href = '/dashboard';
          }, 800); 
        }, 1500);
      } else {
        const errorData = await response.json().catch(() => ({}));
        alert(errorData.message || "Invalid email or password");
      }
    } catch (error) {
      console.error('Login error:', error);
      alert("An error occurred during login. Please try again.");
    }
  };

  const flipStyles = {
    transform: isFlipping ? 'rotateY(90deg)' : 'rotateY(0deg)',
    opacity: isFlipping ? 0 : 1,
    transition: 'transform 0.8s ease-in-out, opacity 0.8s ease-in-out',
    transformStyle: 'preserve-3d',
    position: 'relative',
    zIndex: 10
  };

  const successMessageStyles = {
    display: showSuccess ? 'flex' : 'none',
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    padding: '20px 40px',
    borderRadius: '8px',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
    zIndex: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
    gap: '10px'
  };

  return (
    <>
      {showSuccess && (
        <div style={successMessageStyles}>
          <svg className="animate-bounce w-10 h-10 text-green-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <p className="text-lg font-medium text-gray-800">Login Successful!</p>
          <p className="text-sm text-gray-600">Redirecting you to the dashboard...</p>
        </div>
      )}
      
      <div 
        className="relative min-h-screen w-full bg-cover bg-center bg-no-repeat flex items-center justify-center px-4 pt-4 pb-0"
        style={{ ...{ backgroundImage: `url(${loginBg})` }, ...flipStyles }}
      >
        <img src={logoImg} alt="Logo" className="absolute top-4 left-4 w-36 md:w-44 h-auto" />
        <form
          onSubmit={handleLogin}
          className="relative w-full max-w-md mx-auto bg-transparent backdrop-blur-0 border-0 shadow-none rounded-2xl p-8 text-white"
        >
          <h2 className="text-3xl text-center font-bold mb-6 text-white">Welcome Buddy</h2>

          <label className="block text-white/90 text-sm mb-1">Email</label>
          <input
            type="email"
            placeholder="name@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-3 mb-4 rounded-full border border-white/60 bg-transparent text-black placeholder-white caret-white focus:outline-none focus:ring-2 focus:ring-white focus:border-white"
          />

          <label className="block text-white/90 text-sm mb-1">Password</label>
          <input
            type="password"
            placeholder="********"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-3 mb-4 rounded-full border border-white/60 bg-transparent text-black placeholder-white caret-white focus:outline-none focus:ring-2 focus:ring-white focus:border-white"
          />

          <div className="mb-4 text-right">
            <a href="/forgot" className="text-sm text-blue-200 hover:underline">Forgot Password?</a>
          </div>

          <button
            type="submit"
            className="w-full bg-indigo-500 text-white py-2.5 rounded-md hover:bg-green-600 transition"
          >
            Sign in
          </button>
        </form>
      </div>
      
      {/* Main content with gradient background */}
      <div className="w-full bg-gradient-to-t from-orange-300 via-rose-100 to-amber-100">
        {/* Slideshow of info sections */}
        <section className="w-full text-gray-800">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
            <Slider />
          </div>
        </section>

        <section className="w-full py-12 flex justify-center items-center px-6">
        <div className="max-w-5xl w-full bg-gradient-to-r from-indigo-600/10 to-purple-600/10 rounded-2xl shadow-xl p-10 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Why Choose Trackify 360?</h2>
            <p className="text-gray-700 mb-6">
              Trackify 360 helps teams stay aligned, focused, and productive with a simple yet powerful
              performance management experience.
            </p>

            <ul className="space-y-3 text-gray-800">
              <li className="flex items-start gap-3">
                <CheckCircle className="text-indigo-600 mt-0.5" size={20} />
                <p><strong>Smart Goal Tracking:</strong> Set, update, and monitor KRA & KPI progress with clarity and accuracy.</p>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="text-indigo-600 mt-0.5" size={20} />
                <p><strong>Real-Time Insights:</strong> Visual dashboards and analytics provide instant visibility.</p>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="text-indigo-600 mt-0.5" size={20} />
                <p><strong>Role-Based Access:</strong> Secure access ensures each user only sees what they need.</p>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="text-indigo-600 mt-0.5" size={20} />
                <p><strong>Automated Reports:</strong> Auto-generated summaries and logs save time.</p>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="text-indigo-600 mt-0.5" size={20} />
                <p><strong>Team-Friendly Design:</strong> Built for smooth collaboration and transparency.</p>
              </li>
            </ul>
          </div>

          <div className="flex justify-center">
            <div className="w-72 h-72 rounded-2xl flex items-center justify-center drop-shadow-lg overflow-hidden">
              <img src={whychoseImg} alt="Trackify Illustration" className="w-56 h-56 object-contain animate-spin" />
            </div>
          </div>
        </div>
      </section>
      </div>
      
      {/* Footer */}
      <footer className="w-full py-4 px-8 bg-white border-t border-gray-200">
        <div className="w-full flex flex-col md:flex-row justify-between items-center">
          <div className="flex space-x-4 mb-3 md:mb-0">
            <a href="#" className="text-gray-600 hover:text-gray-900 text-sm">Teams</a>
            <span className="text-gray-300">|</span>
            <a href="#" className="text-gray-600 hover:text-gray-900 text-sm">Privacy</a>
            <span className="text-gray-300">|</span>
            <a href="#" className="text-gray-600 hover:text-gray-900 text-sm">Support</a>
          </div>
          <div className="text-sm text-gray-500 ml-auto md:ml-0">v1.0.0</div>
        </div>
      </footer>
    </>
  );
}

function Slider() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const slides = [
    {
      title: "About Trackify 360",
      body:
        "Trackify 360 is a smart performance management system built to simplify KRA (Key Result Areas) and KPI (Key Performance Indicators) tracking. It helps organizations define, monitor, and evaluate goals through real-time analytics, visual dashboards, and automated reports. Designed for clarity and control, Trackify 360 empowers teams to work smarter, stay aligned, and achieve measurable success.",
      image: aboutImg,
      imageLeft: true,
    },
    {
      title: "KPI & KRA Management",
      body:
        "Trackify 360 makes it easy to create, assign, and monitor KPIs and KRAs for every employee and department. Set clear goals, define measurable targets, and track progress with real-time dashboards and fair, transparent evaluations.",
      image: kpikraImg,
      imageLeft: false,
    },
    {
      title: "Dashboard & Charts",
      body:
        "Interactive dashboards with bar, line, and pie charts provide real-time insights to compare individual, team, or departmental achievements and make data‑driven decisions at a glance.",
      image: dashboardImg,
      imageLeft: true,
    },
    {
      title: "Performance Review & Scoring",
      body:
        "Automatic evaluation based on KPI completion and goal achievements. Managers can review, comment, and approve updates for fair and transparent assessments.",
      image: scoringImg,
      imageLeft: false,
    },
    {
      title: "Notifications & Reminders",
      body:
        "Stay on top of pending KPIs, overdue updates, and upcoming reviews with smart reminders so no deadline is missed.",
      image: notificationImg,
      imageLeft: true,
    },
    {
      title: "Customization",
      body:
        "Customize KPI templates, dashboard layouts, scoring logic, and color themes to match your company’s structure and workflow.",
      image: customImg,
      imageLeft: false,
    },
    {
      title: "Security & Privacy",
      body:
        "Role-based access control and secure authentication protect sensitive performance data while enabling safe, transparent collaboration.",
      image: securityImg,
      imageLeft: true,
    },
  ];

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => {
      setIndex((i) => (i + 1) % slides.length);
    }, 5000);
    return () => clearInterval(t);
  }, [paused, slides.length]);

  const go = (i) => setIndex((i + slides.length) % slides.length);

  const s = slides[index];
  return (
    <div onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 items-center`}>
        {s.imageLeft ? (
          <>
            <div className="order-1">
              <div className="w-full h-64 md:h-72 max-w-md md:max-w-sm mx-auto flex items-center justify-center">
                <img src={s.image} alt={s.title} className="max-h-full max-w-full object-contain" />
              </div>
            </div>
            <div className="order-2">
              <h2 className="text-2xl sm:text-3xl font-bold mb-3 text-gray-900">{s.title}</h2>
              <p className="text-gray-700 leading-relaxed max-w-prose">{s.body}</p>
            </div>
          </>
        ) : (
          <>
            <div className="order-2 md:order-2">
              <div className="w-full h-64 md:h-72 max-w-md md:max-w-sm mx-auto flex items-center justify-center">
                <img src={s.image} alt={s.title} className="max-h-full max-w-full object-contain" />
              </div>
            </div>
            <div className="order-1 md:order-1">
              <h2 className="text-2xl sm:text-3xl font-bold mb-3 text-gray-900">{s.title}</h2>
              <p className="text-gray-700 leading-relaxed max-w-prose">{s.body}</p>
            </div>
          </>
        )}
      </div>

      {/* Controls */}
      <div className="mt-6 flex items-center justify-between">
        <button onClick={() => go(index - 1)} className="px-3 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50">👈</button>
        <div className="flex gap-2">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              className={`h-2.5 w-2.5 rounded-full ${i === index ? 'bg-gray-900' : 'bg-gray-300'}`}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
        <button onClick={() => go(index + 1)} className="px-3 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50">👉</button>
      </div>
    </div>
  );
}
