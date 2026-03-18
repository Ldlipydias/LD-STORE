export async function verifyPixReceipt(base64Image: string, expectedAmount: number, recipientName: string) {
  try {
    const response = await fetch('/api/verify-pix', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        base64Image,
        expectedAmount,
        recipientName
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Erro ao verificar comprovante');
    }

    return await response.json();
  } catch (error) {
    console.error("Verification Error:", error);
    throw error;
  }
}
