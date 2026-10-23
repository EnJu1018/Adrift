import React from 'react';
import MobileGate from './components/MobileGate.jsx';
import { detectMobileDevice, needsMobileGate } from './lib/deviceSupport.js';

const DesktopApp = React.lazy(() => import('./DesktopApp.jsx'));
const deviceDecision = detectMobileDevice();

export default function WebBootstrap() {
  const [mobile, setMobile] = React.useState(() => needsMobileGate() ? true : null);
  React.useEffect(() => {
    let active = true;
    deviceDecision.then(result => { if (active) setMobile(result); });
    return () => { active = false; };
  }, []);

  if (mobile) return <MobileGate />;
  const pending = <p className="web-starting" role="status">正在開啟 Adrift…</p>;
  if (mobile === null) return pending;
  return <React.Suspense fallback={pending}><DesktopApp /></React.Suspense>;
}
