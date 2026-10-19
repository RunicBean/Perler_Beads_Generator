declare const ReactDOM: {
  createPortal(node: React.ReactNode, container: Element): React.ReactNode;
  createRoot(element: HTMLElement): {
    render(node: React.ReactNode): void;
  };
};
