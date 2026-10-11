import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Building2,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock3,
  Mail,
  MapPin,
  PhoneCall,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';

const communityPhotos = [
  '/photo_2026-09-29_11-45-39.jpg',
  '/photo_2026-09-29_11-45-54.jpg',
  '/photo_2026-09-29_11-46-02.jpg',
  '/photo_2026-09-29_11-46-09.jpg',
  '/photo_2026-09-29_11-46-28.jpg',
  '/photo_2026-09-29_11-46-35.jpg',
  '/photo_2026-09-29_11-46-50.jpg',
];

const backgroundImages = [
  'mau7.jfif',
  'mau1.jfif',
  'mau2.jfif',
  'mau3.jfif',
  'mau4.jfif',
  'mau5.jfif',
  'mau6.jfif',
];

export default function HomePage({ page = 'home' }) {
  const [projectPhotoIndex, setProjectPhotoIndex] = useState(0);

  useEffect(() => {
    if (page !== 'project') return undefined;
    const timer = window.setInterval(() => {
      setProjectPhotoIndex(index => (index + 1) % communityPhotos.length);
    }, 5500);
    return () => window.clearInterval(timer);
  }, [page]);

  const changeProjectPhoto = direction => {
    setProjectPhotoIndex(index => (index + direction + communityPhotos.length) % communityPhotos.length);
  };

  const styles = `
    .home-shell {
      min-height: 100vh;
      background:
        radial-gradient(circle at top, rgba(110, 231, 183, 0.35), transparent 30%),
        linear-gradient(135deg, #020d0b 0%, #071d1a 24%, #0a312d 46%, #061912 100%);
      color: #e2e7f0;
      overflow: hidden;
      position: relative;
      isolation: isolate;
    }

    .home-background {
      position: absolute;
      inset: 0;
      z-index: 0;
      overflow: hidden;
      pointer-events: none;
      background: transparent;
    }

    .home-background::after {
      content: '';
      position: absolute;
      inset: 0;
      background:
        linear-gradient(135deg, rgba(4, 16, 13, 0.56), rgba(5, 35, 29, 0.22) 55%, rgba(7, 24, 20, 0.62)),
        radial-gradient(circle at 50% 45%, rgba(74, 222, 128, 0.18), rgba(2, 17, 13, 0.18));
    }

    .home-background-image {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: center;
      opacity: 0;
      transform: scale(1.06);
      filter: brightness(1.18) saturate(1.08);
      animation: homeBackgroundCycle 42s ease-in-out infinite;
    }

    html {
      scroll-behavior: smooth;
    }

    .home-shell::before,
    .home-shell::after {
      content: '';
      position: absolute;
      inset: auto;
      width: 420px;
      height: 420px;
      border-radius: 50%;
      filter: blur(70px);
      opacity: 0.28;
      pointer-events: none;
      z-index: -1;
    }

    .home-shell::before {
      background: radial-gradient(circle, rgba(110, 231, 183, 1) 0%, rgba(52, 211, 153, 0.82) 38%, transparent 72%);
      top: -120px;
      right: -80px;
    }

    .home-shell::after {
      background: radial-gradient(circle, rgba(134, 239, 172, 0.95) 0%, rgba(16, 185, 129, 0.8) 42%, transparent 70%);
      bottom: -150px;
      left: -120px;
    }

    .home-inner {
      max-width: 1440px;
      margin: 0 auto;
      padding: 20px 32px 72px;
      position: relative;
      z-index: 1;
    }

    .home-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 18px 24px;
      border: 1px solid rgba(110, 231, 183, 0.18);
      background: rgba(4, 24, 19, 0.6);
      backdrop-filter: blur(12px);
      border-radius: 0;
      box-shadow: 0 25px 50px rgba(2, 9, 23, 0.25);
      animation: revealDown 0.7s ease both;
    }

    .brand-wrap {
      display: inline-flex;
      align-items: center;
      gap: 14px;
    }

    .brand-logo {
      width: 52px;
      height: 52px;
      border-radius: 16px;
      background: linear-gradient(135deg, #0b2d27 0%, #0f766e 55%, #34d399 100%);
      display: grid;
      place-items: center;
      box-shadow: 0 12px 24px rgba(16, 185, 129, 0.38);
      animation: glow 3s ease-in-out infinite alternate, brandFloat 5s ease-in-out infinite;
      position: relative;
      overflow: hidden;
      padding: 4px;
      background: #f4f8ff;
    }

    .brand-logo-image {
      width: 100%;
      height: 100%;
      object-fit: contain;
      border-radius: 12px;
      position: relative;
      z-index: 1;
    }

    .brand-logo::after {
      content: '';
      position: absolute;
      inset: -45%;
      background: linear-gradient(120deg, transparent 35%, rgba(255, 255, 255, 0.5), transparent 65%);
      transform: translateX(-70%) rotate(18deg);
      animation: logoShine 4.5s ease-in-out infinite;
    }

    .brand-mark {
      font-size: 1.2rem;
      font-weight: 800;
      letter-spacing: 0.08em;
      color: white;
    }

    .brand-copy h2 {
      margin: 0;
      font-size: 1.04rem;
      font-weight: 750;
      letter-spacing: -0.03em;
      color: #e0f2fe;
    }

    .brand-copy small {
      display: block;
      color: #a5f3fc;
      margin-top: 2px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .nav-links {
      display: flex;
      align-items: center;
      gap: 22px;
      color: #dbeafe;
      font-size: 0.95rem;
    }

    .nav-links a {
      color: #dbeafe;
      text-decoration: none;
      transition: color 0.2s ease, transform 0.2s ease;
      position: relative;
      padding: 8px 0;
    }

    .nav-links a:hover {
      color: #7dd3fc;
      transform: translateY(-1px);
    }

    .nav-links a.active {
      color: #7dd3fc;
    }

    .nav-links a::after {
      content: '';
      position: absolute;
      left: 0;
      right: 100%;
      bottom: 0;
      height: 2px;
      background: #1c64f3;
      transition: right 0.25s ease;
    }

    .nav-links a:hover::after {
      right: 0;
    }

    .nav-links a.active::after {
      right: 0;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .ghost-btn,
    .primary-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      border-radius: 999px;
      text-decoration: none;
      transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
      font-weight: 700;
      padding: 0.82rem 1.25rem;
      min-height: 44px;
    }

    .ghost-btn {
      border: 1px solid rgba(148, 160, 184, 0.28);
      background: rgba(15, 24, 42, 0.45);
      color: #e2e7f0;
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.06);
    }

    .primary-btn {
      background: linear-gradient(135deg, #5eead4 0%, #34d399 42%, #10b981 100%);
      color: #04150f;
      box-shadow: 0 18px 30px rgba(16, 185, 129, 0.35);
      position: relative;
      overflow: hidden;
    }

    .primary-btn::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(110deg, transparent 25%, rgba(255, 255, 255, 0.22), transparent 65%);
      transform: translateX(-120%);
      transition: transform 0.55s ease;
    }

    .primary-btn:hover::after {
      transform: translateX(120%);
    }

    .ghost-btn:hover,
    .primary-btn:hover {
      transform: translateY(-2px);
    }

    .ghost-btn:hover {
      border-color: rgba(59, 130, 246, 0.62);
      box-shadow: 0 12px 24px rgba(2, 9, 23, 0.25);
    }

    .hero {
      display: grid;
      grid-template-columns: 1.05fr 0.95fr;
      gap: 42px;
      min-height: calc(100vh - 112px);
      padding-top: 28px;
      padding-bottom: 44px;
      align-items: center;
    }

    .hero-content {
      animation: revealLeft 0.85s 0.12s ease both;
    }

    .eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 14px;
      border-radius: 999px;
      color: #d1fae5;
      background: rgba(16, 185, 129, 0.1);
      border: 1px solid rgba(110, 231, 183, 0.26);
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      box-shadow: 0 0 0 5px rgba(16, 185, 129, 0.04);
    }

    .hero h1 {
      margin: 22px 0 18px;
      font-size: clamp(2.8rem, 5vw, 5rem);
      line-height: 0.96;
      letter-spacing: -0.06em;
      color: #e0f2fe;
      text-wrap: balance;
    }

    .hero h1 .highlight {
      display: block;
      background: linear-gradient(135deg, #7dd3fc 0%, #93c5fd 38%, #bfdbfe 100%);
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
    }

    .hero-copy {
      color: #dbeafe;
      font-size: 1.08rem;
      line-height: 1.8;
      max-width: 680px;
      text-wrap: pretty;
    }

    .hero-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      margin-top: 30px;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(120px, 1fr));
      gap: 16px;
      margin-top: 30px;
    }

    .stat-box {
      background: rgba(15, 24, 42, 0.6);
      border: 1px solid rgba(148, 160, 184, 0.14);
      border-radius: 18px;
      padding: 18px 16px;
      backdrop-filter: blur(9px);
      transition: transform 0.25s ease, border-color 0.25s ease, background 0.25s ease;
    }

    .stat-box:hover {
      transform: translateY(-5px);
      border-color: rgba(59, 130, 246, 0.42);
      background: rgba(28, 39, 61, 0.72);
    }

    .stat-box strong {
      display: block;
      font-size: 1.6rem;
      color: #e0f2fe;
      margin-bottom: 4px;
    }

    .stat-box span {
      color: #bfdbfe;
      font-size: 0.78rem;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .visual-card {
      position: relative;
      padding: 16px;
      border-radius: 30px;
      background: linear-gradient(180deg, rgba(15, 24, 42, 0.8), rgba(15, 24, 42, 0.95));
      border: 1px solid rgba(148, 160, 184, 0.16);
      box-shadow: 0 30px 70px rgba(15, 24, 42, 0.62);
      animation: floatCard 6s ease-in-out infinite;
      animation-delay: 0.35s;
      animation-fill-mode: both;
    }

    .visual-frame {
      position: relative;
      overflow: hidden;
      border-radius: 24px;
      min-height: min(660px, 72vh);
      border: 1px solid rgba(148, 160, 184, 0.08);
      background-position: center;
      background-size: cover;
      background-repeat: no-repeat;
      animation: campusZoom 12s ease-in-out infinite alternate;
    }

    .visual-overlay {
      position: absolute;
      inset: 0;
      background: linear-gradient(180deg, rgba(2, 9, 23, 0.05), rgba(2, 9, 23, 0.72));
    }

    .hero-logo-center {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      z-index: 1;
      pointer-events: none;
    }

    .hero-logo-center::before {
      content: '';
      position: absolute;
      width: 210px;
      height: 210px;
      border: 1px solid rgba(110, 231, 183, 0.52);
      border-radius: 50%;
      box-shadow: 0 0 0 18px rgba(16, 185, 129, 0.08), 0 0 70px rgba(16, 185, 129, 0.3);
      animation: logoOrbit 5s ease-in-out infinite;
    }

    .hero-logo-badge {
      width: 148px;
      height: 148px;
      padding: 10px;
      display: grid;
      place-items: center;
      border: 2px solid rgba(52, 211, 153, 0.82);
      border-radius: 28px;
      background: rgba(2, 9, 23, 0.72);
      box-shadow: 0 20px 70px rgba(2, 9, 23, 0.64);
      color: #a7f3d0;
      animation: logoFloat 4s ease-in-out infinite;
    }

    .hero-mau-logo {
      width: 100%;
      height: 100%;
      object-fit: contain;
      border-radius: 18px;
    }

    .mini-panel {
      position: absolute;
      left: 26px;
      bottom: 26px;
      width: min(260px, 72%);
      background: rgba(15, 24, 42, 0.75);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(148, 160, 184, 0.18);
      border-radius: 18px;
      padding: 18px 16px;
      box-shadow: 0 18px 30px rgba(15, 24, 42, 0.45);
      animation: revealUp 0.8s 0.65s ease both;
    }

    .mini-panel-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 10px;
      color: #e2e7f0;
      font-weight: 700;
      font-size: 0.9rem;
    }

    .mini-panel-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      color: #cbd2e1;
      font-size: 0.8rem;
      margin-top: 8px;
    }

    .mini-pill {
      padding: 4px 8px;
      border-radius: 999px;
      background: rgba(34, 88, 197, 0.12);
      color: #86efac;
      border: 1px solid rgba(74, 222, 128, 0.2);
      font-size: 0.7rem;
      font-weight: 700;
    }

    .feature-section,
    .project-section,
    .contact-section {
      margin: 72px -32px 0;
      padding: 48px 32px 32px;
      border-top: 1px solid rgba(148, 160, 184, 0.22);
      scroll-margin-top: 24px;
    }

    .feature-section {
      background: linear-gradient(110deg, rgba(14, 57, 144, 0.12), transparent 72%);
    }

    .project-section {
      background: linear-gradient(110deg, rgba(22, 48, 101, 0.12), transparent 72%);
    }

    .contact-section {
      background: linear-gradient(110deg, rgba(9, 66, 180, 0.12), transparent 72%);
    }

    .hero {
      scroll-margin-top: 24px;
    }

    .section-heading {
      display: flex;
      align-items: end;
      justify-content: space-between;
      gap: 20px;
      margin-bottom: 26px;
    }

    .section-heading h3 {
      margin: 0;
      font-size: clamp(2rem, 3vw, 2.8rem);
      letter-spacing: -0.05em;
      color: #f8f9fc;
    }

    .section-heading p {
      max-width: 600px;
      color: #94a0b8;
      line-height: 1.7;
      margin: 0;
    }

    .feature-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 22px;
    }

    .feature-card {
      padding: 22px 18px 18px;
      border-radius: 22px;
      border: 1px solid rgba(148, 160, 184, 0.14);
      background: rgba(15, 24, 42, 0.62);
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.02);
      transition: transform 0.2s ease, border-color 0.2s ease;
      position: relative;
      overflow: hidden;
    }

    .feature-card::before {
      content: '';
      position: absolute;
      left: 0;
      top: 0;
      width: 100%;
      height: 3px;
      background: linear-gradient(90deg, #1c64f3, #3b79f5);
      transform: scaleX(0);
      transform-origin: left;
      transition: transform 0.3s ease;
    }

    .feature-card:hover {
      transform: translateY(-4px);
      border-color: rgba(96, 147, 250, 0.45);
      box-shadow: 0 18px 36px rgba(2, 9, 23, 0.28);
    }

    .feature-card:hover::before {
      transform: scaleX(1);
    }

    .icon-box {
      width: 56px;
      height: 56px;
      border-radius: 16px;
      display: grid;
      place-items: center;
      background: linear-gradient(135deg, rgba(60, 122, 245,0.18), rgba(99, 146, 241,0.12));
      border: 1px solid rgba(147, 182, 253, 0.24);
      color: #bfd4fe;
      margin-bottom: 18px;
      transition: transform 0.25s ease, background 0.25s ease;
    }

    .feature-card:hover .icon-box,
    .contact-card:hover .icon-box {
      transform: rotate(-5deg) scale(1.06);
      background: linear-gradient(135deg, rgba(28, 100, 243,0.24), rgba(60, 122, 245,0.2));
    }

    .feature-card h4 {
      margin: 0 0 8px;
      color: #f8f9fc;
      font-size: 1.1rem;
    }

    .feature-card p {
      margin: 0;
      color: #94a0b8;
      line-height: 1.7;
      font-size: 0.96rem;
    }

    .project-wrap {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 28px;
      align-items: center;
      padding: 26px 0 0;
      perspective: 1200px;
    }

    .project-box {
      border-radius: 28px;
      background: rgba(15, 24, 42, 0.66);
      border: 1px solid rgba(148, 160, 184, 0.16);
      padding: 28px;
      box-shadow: 0 18px 40px rgba(2, 9, 23, 0.25);
      position: relative;
      overflow: hidden;
      animation: revealLeft 0.8s 0.12s ease both;
    }

    .project-box::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 5px;
      height: 100%;
      background: linear-gradient(180deg, #1c64f3, #3b79f5);
      box-shadow: 0 0 28px rgba(59, 130, 246, 0.32);
    }

    .project-box p {
      color: #cbd2e1;
      line-height: 1.8;
      font-size: 1.02rem;
    }

    .check-list {
      list-style: none;
      padding: 0;
      margin: 18px 0 0;
      display: grid;
      gap: 12px;
    }

    .check-list li {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 0.96rem;
      color: #e2e7f0;
    }

    .project-visual {
      min-height: 340px;
      border-radius: 28px;
      overflow: hidden;
      position: relative;
      background: #0f182a;
      border: 1px solid rgba(148, 160, 184, 0.16);
      box-shadow: 0 18px 40px rgba(2, 9, 23, 0.28);
      animation: revealRight 0.9s 0.25s ease both;
      transform-style: preserve-3d;
    }

    .project-photo {
      position: absolute;
      inset: 0;
      z-index: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: center 38%;
      animation: projectPhotoMotion 5.5s ease-out both;
    }

    .project-photo-control {
      position: absolute;
      top: 16px;
      z-index: 3;
      width: 38px;
      height: 38px;
      display: grid;
      place-items: center;
      border: 1px solid rgba(226, 231, 240, 0.45);
      border-radius: 50%;
      background: rgba(15, 24, 42, 0.72);
      color: #f8f9fc;
      cursor: pointer;
      transition: background 0.2s ease, transform 0.2s ease;
    }

    .project-photo-control:hover {
      background: rgba(37, 103, 235, 0.88);
      transform: scale(1.06);
    }

    .project-photo-prev { right: 62px; }
    .project-photo-next { right: 16px; }

    .project-visual::before {
      content: '';
      position: absolute;
      inset: 12px;
      border: 1px solid rgba(59, 130, 246, 0.42);
      border-radius: 20px;
      z-index: 2;
      pointer-events: none;
      animation: framePulse 4s ease-in-out infinite;
    }

    .project-visual::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(180deg, rgba(15, 24, 42, 0.1), rgba(15, 24, 42, 0.72));
      z-index: 1;
      pointer-events: none;
    }

    .project-tag {
      position: absolute;
      left: 24px;
      bottom: 24px;
      z-index: 3;
      background: rgba(15, 24, 42, 0.76);
      border: 1px solid rgba(148, 160, 184, 0.14);
      border-radius: 14px;
      padding: 14px 16px;
      color: #f8f9fc;
      max-width: 220px;
      backdrop-filter: blur(8px);
      animation: badgeFloat 4.5s ease-in-out infinite;
    }

    .project-tag::after {
      content: 'MAU';
      position: absolute;
      right: 12px;
      top: 10px;
      color: rgba(147, 197, 253, 0.9);
      font-size: 0.62rem;
      font-weight: 900;
      letter-spacing: 0.12em;
    }

    .project-tag strong {
      display: block;
      font-size: 0.8rem;
      letter-spacing: 0.08em;
      color: #93b6fd;
      text-transform: uppercase;
      margin-bottom: 6px;
    }

    .contact-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 22px;
    }

    .contact-card {
      padding: 24px 20px;
      border-radius: 22px;
      background: rgba(15, 24, 42, 0.64);
      border: 1px solid rgba(148, 160, 184, 0.15);
      transition: transform 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease;
    }

    .contact-card:hover {
      transform: translateY(-5px);
      border-color: rgba(59, 130, 246, 0.42);
      box-shadow: 0 18px 36px rgba(2, 9, 23, 0.25);
    }

    .contact-card .icon-box {
      margin-bottom: 16px;
    }

    .contact-card h4 {
      font-size: 1.04rem;
      margin: 0 0 8px;
      color: #f8f9fc;
    }

    .contact-card p,
    .contact-card a {
      margin: 0;
      color: #cbd2e1;
      text-decoration: none;
      line-height: 1.7;
    }

    .contact-card a {
      display: block;
      overflow-wrap: anywhere;
    }

    .contact-card a + a {
      margin-top: 6px;
    }

    .site-footer {
      margin-top: 80px;
      border-top: 1px solid rgba(148, 160, 184, 0.16);
      padding-top: 28px;
    }

    .footer-inner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
      flex-wrap: wrap;
      padding-bottom: 24px;
    }

    .footer-links {
      display: flex;
      align-items: center;
      justify-content: center;
      flex-wrap: wrap;
      gap: 18px;
      color: #cbd2e1;
    }

    .footer-links a {
      color: #cbd2e1;
      text-decoration: none;
      transition: color 0.2s ease;
    }

    .footer-links a:hover {
      color: #93C5FD;
    }

    .footer-copy {
      color: #94a0b8;
      text-align: right;
      line-height: 1.6;
      font-size: 0.92rem;
    }

    @keyframes glow {
      0% { box-shadow: 0 12px 24px rgba(99, 146, 241, 0.38); }
      100% { box-shadow: 0 18px 34px rgba(96, 147, 250, 0.52); }
    }

    @keyframes logoShine {
      0%, 55% { transform: translateX(-70%) rotate(18deg); }
      75%, 100% { transform: translateX(70%) rotate(18deg); }
    }

    @keyframes revealDown {
      from { opacity: 0; transform: translateY(-18px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @keyframes revealLeft {
      from { opacity: 0; transform: translateX(-24px); }
      to { opacity: 1; transform: translateX(0); }
    }

    @keyframes revealUp {
      from { opacity: 0; transform: translateY(18px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @keyframes revealRight {
      from { opacity: 0; transform: translateX(24px) rotateY(-5deg); }
      to { opacity: 1; transform: translateX(0) rotateY(0); }
    }

    @keyframes framePulse {
      0%, 100% { opacity: 0.38; transform: scale(1); }
      50% { opacity: 0.9; transform: scale(1.015); }
    }

    @keyframes badgeFloat {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-8px); }
    }

    @keyframes floatCard {
      0%, 100% { transform: translateY(0px); }
      50% { transform: translateY(-8px); }
    }

    @keyframes campusZoom {
      0% { background-position: center center; transform: scale(1); }
      100% { background-position: 54% 46%; transform: scale(1.035); }
    }

    @keyframes logoFloat {
      0%, 100% { transform: translateY(0) rotate(-2deg); }
      50% { transform: translateY(-10px) rotate(2deg); }
    }

    @keyframes brandFloat {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-3px); }
    }

    @keyframes logoOrbit {
      0%, 100% { transform: scale(0.96); opacity: 0.58; }
      50% { transform: scale(1.08); opacity: 1; }
    }

    @keyframes projectPhotoMotion {
      from { opacity: 0.55; transform: scale(1.08); }
      to { opacity: 1; transform: scale(1); }
    }

    @keyframes homeBackgroundCycle {
      0%, 12% { opacity: 1; transform: scale(1.04); }
      17%, 100% { opacity: 0; transform: scale(1.12); }
    }

    @media (prefers-reduced-motion: reduce) {
      .home-background-image {
        animation: none;
        opacity: 0;
        transform: none;
      }

      .home-background-image:first-child {
        opacity: 1;
      }
    }

    @media (max-width: 980px) {
      .hero,
      .project-wrap,
      .feature-grid,
      .contact-grid {
        grid-template-columns: 1fr 1fr;
      }

      .hero {
        grid-template-columns: 1fr;
      }

      .feature-grid,
      .contact-grid {
        grid-template-columns: 1fr 1fr;
      }
    }

    @media (max-width: 760px) {
      .home-header {
        flex-wrap: wrap;
        justify-content: center;
      }

      .nav-links {
        width: 100%;
        justify-content: center;
        order: 3;
        gap: 14px;
        font-size: 0.82rem;
      }

      .hero {
        padding-top: 52px;
        min-height: auto;
      }

      .section-heading {
        flex-direction: column;
        align-items: flex-start;
      }

      .feature-grid,
      .contact-grid,
      .project-wrap {
        grid-template-columns: 1fr;
      }

      .stats-grid {
        grid-template-columns: 1fr;
      }

      .header-actions {
        width: 100%;
        justify-content: center;
      }

      .header-actions a {
        flex: 1;
      }

      .home-inner {
        padding-left: 16px;
        padding-right: 16px;
      }

      .feature-section,
      .project-section,
      .contact-section {
        margin-left: -16px;
        margin-right: -16px;
        padding-left: 16px;
        padding-right: 16px;
      }

      .visual-frame {
        min-height: 420px;
      }
    }

  `;

  return (
    <>
      <style>{styles}</style>

      <div className="home-shell">
        <div className="home-background" aria-hidden="true">
          {backgroundImages.map((image, index) => (
            <img
              key={image}
              className="home-background-image"
              src={`/login-backgrounds/${image}`}
              alt=""
              style={{ animationDelay: `-${index * 6}s` }}
            />
          ))}
        </div>
        <div className="home-inner">
          <header className="home-header">
            <div className="brand-wrap">
              <div className="brand-logo" aria-label="Mekdela Amba University logo">
                <img className="brand-logo-image" src="/mau-logo.png" alt="Mekdela Amba University logo" />
              </div>
              <div className="brand-copy">
                <h2>Mekdela Amba University</h2>
                <small>Smart Workforce</small>
              </div>
            </div>

            <nav className="nav-links" aria-label="Main navigation">
              <Link to="/" className={page === 'home' ? 'active' : ''}>Home</Link>
              <Link to="/features" className={page === 'features' ? 'active' : ''}>Features</Link>
              <Link to="/project" className={page === 'project' ? 'active' : ''}>Project</Link>
              <Link to="/contact" className={page === 'contact' ? 'active' : ''}>Contact</Link>
            </nav>

            <div className="header-actions">
              <Link to="/login" className="ghost-btn">Login</Link>
              <Link to="/signup" className="primary-btn">Register <ArrowRight size={16} /></Link>
            </div>
          </header>

          {page === 'home' && <main className="hero" id="home">
            <div className="hero-content">
              <span className="eyebrow">
                <Sparkles size={12} /> MEKDELA ABBA UNIVERSITY
              </span>

              <h1>
                Smart
                <span className="highlight">attendance for</span>
                our university community.
              </h1>

              <p className="hero-copy">
                A secure digital attendance system for staff and departments, with one clear and transparent process.
                Manage employee attendance, monitor department performance, export daily, weekly, monthly,
                quarterly and yearly reports, and keep the university community informed through automated notifications.
              </p>

              <div className="hero-actions">
                <Link to="/login" className="primary-btn">Get Started <ArrowRight size={16} /></Link>
                <Link to="/signup" className="ghost-btn">Create Account</Link>
              </div>

              <div className="stats-grid">
                <div className="stat-box">
                  <strong>24/7</strong>
                  <span>Live tracking</span>
                </div>
                <div className="stat-box">
                  <strong>99.9%</strong>
                  <span>Accuracy</span>
                </div>
                <div className="stat-box">
                  <strong>1 click</strong>
                  <span>Admin insights</span>
                </div>
              </div>
            </div>

            <div className="visual-card" aria-label="Workplace attendance overview">
              <div
                className="visual-frame"
                style={{ backgroundImage: `url(${communityPhotos[0]})` }}
              >
                <div className="visual-overlay" />
                <div className="hero-logo-center" aria-label="Mekdela Amba University logo">
                  <div className="hero-logo-badge">
                    <img className="hero-mau-logo" src="/mau-logo.png" alt="Mekdela Amba University logo" />
                  </div>
                </div>
                <div className="mini-panel">
                  <div className="mini-panel-top">
                    <span>Attendance Overview</span>
                    <span className="mini-pill">Live</span>
                  </div>
                  <div className="mini-panel-row">
                    <span>Present</span>
                    <strong>216</strong>
                  </div>
                  <div className="mini-panel-row">
                    <span>Late</span>
                    <strong>12</strong>
                  </div>
                  <div className="mini-panel-row">
                    <span>On Leave</span>
                    <strong>09</strong>
                  </div>
                </div>
              </div>
            </div>
          </main>}

          {page === 'features' && <section className="feature-section" id="features">
            <div className="section-heading">
              <h3>Built for operational clarity</h3>
              <p>
                Every feature is designed to make staff attendance easier to manage, easier to verify,
                and easier to report across teams and departments.
              </p>
            </div>

            <div className="feature-grid">
              <article className="feature-card">
                <div className="icon-box">
                  <Clock3 size={24} />
                </div>
                <h4>Department attendance</h4>
                <p>Track employee attendance by department with daily, weekly, monthly, quarterly, and yearly oversight.</p>
              </article>

              <article className="feature-card">
                <div className="icon-box">
                  <ShieldCheck size={24} />
                </div>
                <h4>Admin control</h4>
                <p>Administrators can manage all employees, update settings, and control workforce workflows securely.</p>
              </article>

              <article className="feature-card">
                <div className="icon-box">
                  <Users size={24} />
                </div>
                <h4>Messages & notifications</h4>
                <p>Send updates, reminders, and alerts to employees and departments from one central control point.</p>
              </article>

              <article className="feature-card">
                <div className="icon-box">
                  <CheckCircle2 size={24} />
                </div>
                <h4>Export & certificates</h4>
                <p>Download attendance records in Excel or PDF and generate recognition or completion certificates.</p>
              </article>
            </div>
          </section>}

          {page === 'project' && <section className="project-section" id="project">
            <div className="section-heading">
              <h3>About the project</h3>
            </div>

            <div className="project-wrap">
              <div className="project-box">
                <p>
                  MAU Attendance is a major university management project focused on digital workforce transformation.
                  It combines a modern React frontend, secure backend services, and smart reporting tools to manage
                  employee attendance, department tracking, system settings, notifications, and full attendance compliance.
                </p>

                <ul className="check-list">
                  <li><CheckCircle2 size={18} color="#86efac" /> Full employee and department control for the admin role.</li>
                  <li><CheckCircle2 size={18} color="#86efac" /> Attendance reports by department with daily, weekly, monthly, quarterly and yearly review.</li>
                  <li><CheckCircle2 size={18} color="#86efac" /> Excel and PDF download options for attendance and compliance records.</li>
                  <li><CheckCircle2 size={18} color="#86efac" /> Automated communication, certificate issuance, and complete attendance tracking.</li>
                </ul>
              </div>

              <div className="project-visual" aria-label="MAU community photo slideshow">
                <img
                  key={communityPhotos[projectPhotoIndex]}
                  className="project-photo"
                  src={communityPhotos[projectPhotoIndex]}
                  alt={`Mekdela Amba University community photo ${projectPhotoIndex + 1}`}
                />
                <button type="button" className="project-photo-control project-photo-prev"
                  onClick={() => changeProjectPhoto(-1)} aria-label="Previous community photo">
                  <ChevronLeft size={18} />
                </button>
                <button type="button" className="project-photo-control project-photo-next"
                  onClick={() => changeProjectPhoto(1)} aria-label="Next community photo">
                  <ChevronRight size={18} />
                </button>
                <div className="project-tag">
                  <strong>Major system</strong>
                  Attendance intelligence platform for corporate teams.
                </div>
              </div>
            </div>
          </section>}

          {page === 'contact' && <section className="contact-section" id="contact">
            <div className="section-heading">
              <h3>Contact us</h3>
            </div>

            <div className="contact-grid">
              <div className="contact-card">
                <div className="icon-box">
                  <Mail size={22} />
                </div>
                <h4>Email</h4>
                <a href="mailto:tsegayehu2@gmail.com">tsegayehu2@gmail.com</a>
                <a href="mailto:sinteyehukalkidan@gmail.com">sinteyehukalkidan@gmail.com</a>
              </div>

              <div className="contact-card">
                <div className="icon-box">
                  <PhoneCall size={22} />
                </div>
                <h4>Phone</h4>
                <a href="tel:0995207802">0995207802</a>
                <a href="tel:0968067828">0968067828</a>
              </div>

              <div className="contact-card">
                <div className="icon-box">
                  <MapPin size={22} />
                </div>
                <h4>Location</h4>
                <p>Demo Gemba, Bahir Dar, Ethiopia</p>
              </div>
            </div>
          </section>}

          <footer className="site-footer">
            <div className="footer-inner">
              <div>
                <div className="brand-wrap">
                  <div className="brand-logo" aria-label="Mekdela Amba University logo">
                    <img className="brand-logo-image" src="/mau-logo.png" alt="Mekdela Amba University logo" />
                  </div>
                  <div className="brand-copy">
                    <h2>Mekdela Amba University</h2>
                    <small>Smart Workforce</small>
                  </div>
                </div>
              </div>

              <div className="footer-links">
                <Link to="/">Home</Link>
                <Link to="/features">Features</Link>
                <Link to="/project">Project</Link>
                <Link to="/contact">Contact</Link>
              </div>

              <div className="footer-copy">
                © 2026 Mekdela Amba University Attendance.<br />
                All rights reserved.
              </div>
            </div>
          </footer>
        </div>
      </div>
    </>
  );
}
