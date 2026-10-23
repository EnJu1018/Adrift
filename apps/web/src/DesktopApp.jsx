import { MotionConfig } from 'framer-motion';
import 'mapbox-gl/dist/mapbox-gl.css';
import './styles.css';
import App from './App.jsx';

export default function DesktopApp() {
  return <MotionConfig reducedMotion="user"><App /></MotionConfig>;
}
