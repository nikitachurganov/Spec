type Props = {
  busy: boolean;
  onClick: () => void;
};

export function GenerateButton({ busy, onClick }: Props) {
  return (
    <button type="button" className="primary" disabled={busy} onClick={onClick}>
      {busy ? 'Собираю спецификацию...' : 'Собрать спецификацию'}
    </button>
  );
}
