type GenerateButtonProps = {
  isLoading: boolean;
  onClick: () => void;
};

export function GenerateButton({ isLoading, onClick }: GenerateButtonProps) {
  return (
    <button
      type="button"
      className="generate-button"
      disabled={isLoading}
      onClick={onClick}
      data-hierarchy="primary"
      data-size="medium 44 px"
      data-state={isLoading ? 'loading' : 'default'}
      data-istoggled="false"
      data-icon-left="false"
      data-icon-right="false"
    >
      <span className="generate-button__text">
        {isLoading ? 'Собираю спецификацию...' : 'Собрать спецификацию'}
      </span>
    </button>
  );
}
