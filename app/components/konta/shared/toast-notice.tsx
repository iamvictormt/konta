import Icon from "../../ui-icon";

export function ToastNotice({ message }: { message: string }) {
  if (!message) return null;
  return <div className="toast" role="status"><Icon name="check" size={17} />{message}</div>;
}
