import type ThreePreview from './ThreePreview';
type Props = React.ComponentProps<typeof ThreePreview>;
const Preview = React.lazy(() => import('./ThreePreview.js'));
export default function LazyThreePreview(props: Props) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [visible, setVisible] = React.useState(false);
  React.useEffect(() => {
    if (!ref.current) return;
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) { setVisible(true); observer.disconnect(); } });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  const hasBeads = props.project.cells.some(Boolean);
  return <div ref={ref} style={{ minHeight: 160 }}>
    {visible && hasBeads ? <React.Suspense fallback={<p role="status">正在加载 3D 预览…</p>}><Preview {...props}/></React.Suspense> : <p style={{ padding: 24, textAlign: 'center' }}>{props.emptyLabel}</p>}
  </div>;
}
