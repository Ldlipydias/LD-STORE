export const sendSupportEmail = async (to: string, subject: string, text: string, html?: string) => {
  try {
    const response = await fetch('/api/send-support-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to,
        subject,
        text,
        html,
      }),
    });

    const result = await response.json();
    console.log('Email Result:', result);
    return result;
  } catch (error) {
    console.error('Error sending email:', error);
    return { success: false, error };
  }
};
