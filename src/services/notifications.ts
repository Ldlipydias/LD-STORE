export async function notifyAdmin(title: string, body: string, url: string = '/admin') {
  try {
    const response = await fetch('/api/push/notify-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, body, url })
    });
    return await response.json();
  } catch (error) {
    console.error('Error triggering admin notification:', error);
    return { success: false, error };
  }
}
