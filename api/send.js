const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

module.exports = async (req, res) => {
    // Adicionar cabeçalhos CORS para permitir chamadas do seu site
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    // Responder a pré-vôos de CORS
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método não permitido' });
    }

    const { name, email, phone, company, subject, message } = req.body;

    // Log básico para depuração (visível nos logs do Vercel)
    console.log(`Novo envio de formulário de: ${name} (${email})`);

    try {
        const data = await resend.emails.send({
            from: 'Leandro Recicle <onboarding@resend.dev>',
            to: ['leandrocomerciodereciclagem@gmail.com'],
            subject: `Novo Lead: ${subject} - ${name}`,
            html: `
                <div style="font-family: sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
                    <h2 style="color: #2d6a4f; margin-top: 0; text-transform: uppercase;">Novo Contato Leandro Recicle</h2>
                    <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
                    <p><strong>Nome:</strong> ${name}</p>
                    <p><strong>E-mail:</strong> ${email || 'Não informado'}</p>
                    <p><strong>WhatsApp:</strong> ${phone || 'Não informado'}</p>
                    <p><strong>Empresa:</strong> ${company || 'Não informada'}</p>
                    <p><strong>Assunto:</strong> ${subject}</p>
                    
                    <div style="background: #f9f9f9; padding: 15px; border-radius: 5px; margin-top: 20px;">
                        <p><strong>Mensagem:</strong></p>
                        <p style="white-space: pre-wrap;">${message}</p>
                    </div>
                    
                    <footer style="margin-top: 30px; font-size: 12px; color: #999; text-align: center;">
                        <p>Este e-mail foi gerado automaticamente pelo formulário do seu site.</p>
                    </footer>
                </div>
            `
        });

        return res.status(200).json({ success: true, data });
    } catch (error) {
        console.error('Erro no Resend:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
};
