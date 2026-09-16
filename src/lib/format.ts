export function maskPhone(phone: string): string {
  const normalized = phone.replace(/\s+/g, "");

  if (normalized.length <= 6) {
    return "***";
  }

  return `${normalized.slice(0, 3)}****${normalized.slice(-3)}`;
}
