type ToggleRowProps = {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
};

export function ToggleRow({ label, checked, disabled = false, onChange }: ToggleRowProps) {
  const displayChecked = disabled ? false : checked;

  return (
    <button
      type="button"
      className="toggle-row"
      role="switch"
      aria-checked={displayChecked}
      disabled={disabled}
      data-disabled={disabled ? 'true' : 'false'}
      onClick={() => {
        if (!disabled) {
          onChange(!checked);
        }
      }}
    >
      <span className="toggle-row__label">{label}</span>

      <span className="toggle-row__control" data-checked={displayChecked ? 'true' : 'false'}>
        <span className="toggle-row__thumb" />
      </span>
    </button>
  );
}
