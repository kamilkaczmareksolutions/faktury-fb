const axios = require('axios');
const fs = require('fs/promises');
const path = require('path');
const { format, subMonths, startOfMonth, endOfMonth } = require('date-fns');

class MetaInvoiceDownloader {
    constructor(accessToken, businessId, apiVersion = 'v20.0') {
        if (!accessToken || !businessId) {
            throw new Error('Access Token and Business ID are required.');
        }
        this.accessToken = accessToken;
        this.businessId = businessId;
        this.baseUrl = `https://graph.facebook.com/${apiVersion}`;
    }

    async #fetchInvoices(startDate, endDate) {
        const url = `${this.baseUrl}/${this.businessId}/business_invoices`;
        const params = {
            access_token: this.accessToken,
            start_date: startDate,
            end_date: endDate,
            fields: 'id,invoice_id,billing_period,download_uri,billed_amount_details'
        };

        try {
            console.log(`Fetching invoices from ${startDate} to ${endDate}...`);
            const response = await axios.get(url, { params });
            
            if (response.data && response.data.data) {
                console.log(`Found ${response.data.data.length} invoices.`);
                return response.data.data;
            }
            return [];
        } catch (error) {
            console.error('Error fetching invoices:', error.response ? error.response.data : error.message);
            throw error;
        }
    }

    async #downloadPdf(invoice, directory) {
        const { download_uri, invoice_id, billing_period } = invoice;
        if (!download_uri) {
            console.warn(`Invoice ${invoice_id} does not have a download URI. Skipping.`);
            return null;
        }

        const fileName = `Meta_Invoice_${invoice_id}_${billing_period}.pdf`;
        const filePath = path.join(directory, fileName);

        try {
            console.log(`Downloading invoice ${invoice_id} to ${filePath}...`);
            const response = await axios.get(download_uri, {
                responseType: 'arraybuffer'
            });

            await fs.mkdir(directory, { recursive: true });
            await fs.writeFile(filePath, response.data);
            console.log(`Successfully downloaded ${fileName}`);
            return filePath;
        } catch (error) {
            console.error(`Error downloading PDF for invoice ${invoice_id}:`, error.message);
            return null;
        }
    }

    async downloadAllInvoices(startDate, endDate, outputDir = 'invoices') {
        const invoices = await this.#fetchInvoices(startDate, endDate);
        const downloadedFiles = [];

        for (const invoice of invoices) {
            const filePath = await this.#downloadPdf(invoice, outputDir);
            if (filePath) {
                downloadedFiles.push(filePath);
            }
        }
        return downloadedFiles;
    }

    async downloadLastMonthInvoices(outputDir = 'invoices') {
        const now = new Date();
        const prevMonth = subMonths(now, 1);
        const startDate = format(startOfMonth(prevMonth), 'yyyy-MM-dd');
        const endDate = format(endOfMonth(prevMonth), 'yyyy-MM-dd');
        
        return this.downloadAllInvoices(startDate, endDate, outputDir);
    }
}

module.exports = MetaInvoiceDownloader; 