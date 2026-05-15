type Props = {
  text: string;
  variant: 'idle' | 'error' | 'success';
};

export function StatusMessage({ text, variant }: Props) {
  if (variant === 'error') {
    return (
      <div className="error show" role="alert">
        {text}
      </div>
    );
  }
  return <div className="status">{text}</div>;
}
