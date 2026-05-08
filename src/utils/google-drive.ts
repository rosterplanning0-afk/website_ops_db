import { google } from 'googleapis';
import path from 'path';
import { Readable } from 'stream';
import fs from 'fs';

const SCOPES = ['https://www.googleapis.com/auth/drive'];

async function getDriveService() {
    const tokenPath = process.env.GOOGLE_TOKEN_PATH || 'token.json';
    const resolvedTokenPath = path.isAbsolute(tokenPath) ? tokenPath : path.join(process.cwd(), tokenPath);

    if (fs.existsSync(resolvedTokenPath)) {
        const tokenData = JSON.parse(fs.readFileSync(resolvedTokenPath, 'utf-8'));
        const oauth2Client = new google.auth.OAuth2(
            tokenData.client_id,
            tokenData.client_secret
        );
        oauth2Client.setCredentials({
            access_token: tokenData.token,
            refresh_token: tokenData.refresh_token,
            expiry_date: tokenData.expiry ? new Date(tokenData.expiry).getTime() : undefined,
            token_type: 'Bearer',
            scope: tokenData.scopes?.join(' ')
        });
        return google.drive({ version: 'v3', auth: oauth2Client });
    }

    const credentialsPath = process.env.GOOGLE_CREDENTIALS_PATH || 'google_credentials.json';
    const resolvedPath = path.isAbsolute(credentialsPath)
        ? credentialsPath
        : path.join(process.cwd(), credentialsPath);

    const auth = new google.auth.GoogleAuth({
        keyFile: resolvedPath,
        scopes: SCOPES,
    });

    return google.drive({ version: 'v3', auth });
}

export async function uploadFileToDrive(fileBuffer: Buffer, fileName: string, mimeType: string) {
    const drive = await getDriveService();
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

    const fileMetadata = {
        name: fileName,
        parents: folderId ? [folderId] : [],
    };

    // Convert Buffer to Readable Stream
    const bufferStream = new Readable();
    bufferStream.push(fileBuffer);
    bufferStream.push(null);

    const media = {
        mimeType: mimeType,
        body: bufferStream,
    };

    try {
        const response = await drive.files.create({
            requestBody: fileMetadata,
            media: media,
            fields: 'id, webViewLink, webContentLink',
            supportsAllDrives: true,
        } as any);

        const fileId = response.data.id;

        // Set permission to anyone with the link can view
        await drive.permissions.create({
            fileId: fileId!,
            requestBody: {
                role: 'reader',
                type: 'anyone',
            },
            supportsAllDrives: true,
        } as any);

        return {
            fileId: fileId,
            webViewLink: response.data.webViewLink,
            webContentLink: response.data.webContentLink,
        };
    } catch (error) {
        console.error('Error uploading file to Google Drive:', error);
        throw error;
    }
}
