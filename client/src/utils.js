export function getCategoryColor(category) {
  const map = {
    bill: 'cat-orange',
    personal: 'cat-blue',
    government: 'cat-red',
    legal: 'cat-red',
    medical: 'cat-pink',
    insurance: 'cat-teal',
    financial: 'cat-green',
    advertisement: 'cat-gray',
    subscription: 'cat-purple',
    tax: 'cat-yellow',
    other: 'cat-gray',
  };
  return map[category] || 'cat-gray';
}

export function getCategoryIcon(category) {
  const map = {
    bill: '💳',
    personal: '✉️',
    government: '🏛️',
    legal: '⚖️',
    medical: '🏥',
    insurance: '🛡️',
    financial: '🏦',
    advertisement: '📢',
    subscription: '📰',
    tax: '🧾',
    other: '📄',
  };
  return map[category] || '📄';
}

export function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return d.toLocaleDateString();
}
