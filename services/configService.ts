
// [SECURITY PATCH]
// This service has been deprecated pursuant to strict security protocols.
// API Keys are now exclusively managed within Supabase Edge Function Secrets.
// Frontend access to keys is physically severed.

export const configService = {
    async getGoogleApiKey(): Promise<string | null> {
        console.error("Security Warning: Attempted to access deprecated ConfigService. Access denied.");
        return null;
    }
};
