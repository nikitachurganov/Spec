type Props = {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
};

export function SectionToggle({ label, checked, onChange }: Props) {
  return (
    <label className="checkbox-row">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => {
          onChange(e.target.checked);
        }}
      />
      <span>{label}</span>
    </label>
  );
}
