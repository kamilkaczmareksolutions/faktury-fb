const MetaInvoiceDownloader = require('../lib/MetaInvoiceDownloader');
const nodemailer = require('nodemailer');
const path = require('path');
const { format, subMonths } = require('date-fns');
const { pl } = require('date-fns/locale');


async function sendEmailWithAttachments(files, monthName) {
    const { EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_APP_PASSWORD, EMAIL_TO } = process.env;

    if (!EMAIL_HOST || !EMAIL_USER || !EMAIL_APP_PASSWORD || !EMAIL_TO) {
        console.error('Email environment variables are not fully set.');
        throw new Error('Email configuration is incomplete.');
    }
    
    // Konfiguracja transportera dla nodemailer
    // Przykład dla Gmail. Dla innych serwisów (np. Onet, WP) mogą być inne dane.
    let transporter = nodemailer.createTransport({
        host: EMAIL_HOST, // np. "smtp.gmail.com"
        port: EMAIL_PORT || 587,
        secure: (EMAIL_PORT || 587) == 465, // true dla portu 465, false dla innych
        auth: {
            user: EMAIL_USER, // Twój adres email
            pass: EMAIL_APP_PASSWORD, // Hasło do aplikacji, NIE hasło do konta email
        },
    });
    
    const attachments = files.map(filePath => ({
        filename: path.basename(filePath),
        path: filePath,
        contentType: 'application/pdf'
    }));
    
    const mailOptions = {
        from: `"Automat Faktur Meta" <${EMAIL_USER}>`,
        to: EMAIL_TO,
        subject: `Automatyczne faktury Meta za ${monthName}`,
        text: `Cześć,\n\nW załączniku znajdują się faktury za reklamy Meta za ${monthName}.\n\nPozdrawiam,\nAutomat`,
        html: `<p>Cześć,</p><p>W załączniku znajdują się faktury za reklamy Meta za <b>${monthName}</b>.</p><p>Pozdrawiam,<br>Automat</p>`,
        attachments: attachments,
    };

    console.log(`Sending email to ${EMAIL_TO}...`);
    await transporter.sendMail(mailOptions);
    console.log('Email sent successfully!');
}


module.exports = async (req, res) => {
    const {
        META_ACCESS_TOKEN,
        META_BUSINESS_ID
    } = process.env;

    if (!META_ACCESS_TOKEN || !META_BUSINESS_ID) {
        return res.status(500).send('Environment variables META_ACCESS_TOKEN and META_BUSINESS_ID must be set.');
    }

    try {
        const downloader = new MetaInvoiceDownloader(META_ACCESS_TOKEN, META_BUSINESS_ID);
        
        console.log('Cron job started: Downloading last month\'s invoices.');
        // Vercel ma tymczasowy system plików, więc zapisujemy do /tmp
        const files = await downloader.downloadLastMonthInvoices('/tmp');
        
        if (files.length > 0) {
            const prevMonth = subMonths(new Date(), 1);
            const monthName = format(prevMonth, 'LLLL yyyy', { locale: pl });
            await sendEmailWithAttachments(files, monthName);
        } else {
            console.log('No invoices found for the last month. Skipping email.');
        }

        console.log('Cron job finished successfully.');
        res.status(200).json({ success: true, message: `Downloaded ${files.length} invoices.` });

    } catch (error) {
        console.error('Cron job failed:', error);
        res.status(500).json({ success: false, message: 'Cron job failed.', error: error.message });
    }
}; 