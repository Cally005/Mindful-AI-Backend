// src/services/whatsapp.service.ts

import axios from 'axios';
import { supabase } from '../config/supabase.js';
import { config } from '../config/index.js';

interface WhatsAppTokenData {
  access_token: string;
  token_type: string;
  expires_in?: number;
}

interface WhatsAppMessageOptions {
  to: string;
  type: 'text' | 'template';
  content: string | {
    name: string;
    language: { code: string };
  };
}

interface WABAData {
  waba_id: string;
  phone_number_id: string;
  user_id: string;
  verified_name: string;
  display_phone_number: string;
  access_token: string; // Added access_token property
}

interface WhatsAppAccountDetails {
    id: string;
    name: string;
    phone_numbers: Array<{
      id: string;
      display_phone_number: string;
      verified_name: string;
    }>;
  }

class WhatsAppService {
  private appId: string;
  private appSecret: string;
  private configId: string;
  private redirectUri: string;
  private apiVersion: string = 'v18.0';


  constructor() {
    this.appId = config.env.meta.appId;
    this.appSecret = config.env.meta.appSecret;
    this.configId = config.env.meta.whatsappAuthConfig;
    this.redirectUri = config.env.meta.redirectUri || 'http://localhost:3000/whatsapp';
    this.apiVersion = config.env.meta.apiVersion || 'v18.0';
    
  }

  /**
   * Generate the OAuth URL for WhatsApp Business sign-up
   */
  getAuthorizationUrl(customRedirectUri?: string): string {
    const redirectUri = customRedirectUri || this.redirectUri;
    
    const params = new URLSearchParams({
      client_id: this.appId,
      config_id: this.configId,
      response_type: 'token', // Changed from 'code' to 'token'
      redirect_uri: redirectUri,
      display: 'popup', // Added display parameter
      scope: 'whatsapp_business_management,whatsapp_business_messaging,business_management', // Added scope
      fallback_redirect_uri: redirectUri // Optional: add fallback redirect
    });
  
    return `https://www.facebook.com/${this.apiVersion}/dialog/oauth?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code: string, customRedirectUri?: string): Promise<WhatsAppTokenData> {
    try {
      const redirectUri = customRedirectUri || this.redirectUri;
      
      const params = new URLSearchParams({
        client_id: this.appId,
        client_secret: this.appSecret,
        redirect_uri: redirectUri,
        code: code,
      });

      const url = `https://graph.facebook.com/${this.apiVersion}/oauth/access_token?${params.toString()}`;
      
      const response = await axios.get(url);
      return response.data;
    } catch (error: any) {
      console.error('Error exchanging code for token:', error.response?.data || error.message);
      throw new Error(`Failed to exchange code for token: ${error.response?.data?.error?.message || error.message}`);
    }
  }
  /**
   * Fetch WhatsApp Business Accounts associated with the access token
   */
// src/services/whatsapp.service.ts
async fetchWhatsAppBusinessAccounts(accessToken: string): Promise<WhatsAppAccountDetails[]> {
    try {
      // Use the correct endpoint for fetching businesses with WhatsApp accounts
      const response = await axios.get(
        'https://graph.facebook.com/v22.0/me/businesses', 
        {
          params: {
            access_token: accessToken,
            fields: 'owned_whatsapp_business_accounts{phone_numbers,id,name}'
          }
        }
      );
  
      // Log the full response for debugging
      console.log('Full Business Response:', JSON.stringify(response.data, null, 2));
  
      // Extract and flatten WhatsApp Business Accounts
      const whatsappAccounts: WhatsAppAccountDetails[] = [];
  
      // Iterate through businesses
      response.data.data.forEach((business: any) => {
        // Check if the business has owned WhatsApp Business Accounts
        if (business.owned_whatsapp_business_accounts && 
            business.owned_whatsapp_business_accounts.data) {
          
          // Map and add each WhatsApp Business Account
          business.owned_whatsapp_business_accounts.data.forEach((wabaAccount: any) => {
            whatsappAccounts.push({
              id: wabaAccount.id,
              name: wabaAccount.name,
              phone_numbers: wabaAccount.phone_numbers?.data?.map((phone: any) => ({
                id: phone.id,
                display_phone_number: phone.display_phone_number,
                verified_name: phone.verified_name
              })) || []
            });
          });
        }
      });
  
      // Log the mapped WhatsApp accounts
      console.log('Mapped WhatsApp Accounts:', JSON.stringify(whatsappAccounts, null, 2));
  
      // Check if any accounts were found
      if (whatsappAccounts.length === 0) {
        console.warn('No WhatsApp Business Accounts found in the response');
      }
  
      return whatsappAccounts;
    } catch (error: any) {
      // Detailed error logging
      console.error('Error fetching accounts:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
  
      // Log full error details for debugging
      console.error('Full error response:', JSON.stringify(error.response, null, 2));
  
      throw error;
    }
  }
  /**
   * Complete WhatsApp integration process with token-based flow
   */
 
async completeTokenIntegration(
  accessToken: string, 
  userId: string
): Promise<{
  waba_id: string;
  phone_number_id: string;
  display_phone_number: string;
  verified_name: string;
}> {
  try {
    // Fetch WhatsApp Business Accounts
    const accounts = await this.fetchWhatsAppBusinessAccounts(accessToken);

    // If no accounts found
    if (accounts.length === 0) {
      throw new Error('No WhatsApp Business Accounts found for the provided access token');
    }

    // Select the first account
    const selectedAccount = accounts[0];
    
    // Ensure phone numbers exist
    if (!selectedAccount.phone_numbers || selectedAccount.phone_numbers.length === 0) {
      throw new Error('No phone numbers found for the selected WhatsApp Business Account');
    }

    const phoneNumber = selectedAccount.phone_numbers[0];

    // Instead of registering, just save the details
    await this.saveWhatsAppDetails(
      userId, 
      selectedAccount.id, 
      phoneNumber.id, 
      accessToken,   {
        verified_name: phoneNumber.verified_name,
        display_phone_number: phoneNumber.display_phone_number
      }
    );

    return {
      waba_id: selectedAccount.id,
      phone_number_id: phoneNumber.id,
      display_phone_number: phoneNumber.display_phone_number || 'Unknown',
      verified_name: phoneNumber.verified_name,
    };
  } catch (error) {
    console.error('Comprehensive integration error:', error);
    throw error;
  }
}
 /**
 * Register the customer's phone number for Cloud API
 */
async registerPhoneNumber(accessToken: string, phoneNumberId: string): Promise<boolean> {
    try {
      const url = `https://graph.facebook.com/${this.apiVersion}/${phoneNumberId}/register`;
      
      const response = await axios.post(url, 
        {
          // Add the required messaging_product parameter
          messaging_product: 'whatsapp'
        }, 
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
  
      return response.status === 200;
    } catch (error: any) {
      console.error('Error registering phone number:', error.response?.data || error.message);
      throw new Error(`Failed to register phone number: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  /**
   * Subscribe to webhooks on the customer's WABA
   */
  async subscribeToWebhooks(accessToken: string, wabaId: string): Promise<boolean> {
    try {
      const webhookUrl = config.env.meta.webhookUrl;
      
      if (!webhookUrl) {
        throw new Error('Webhook URL is not configured');
      }
  
      const url = `https://graph.facebook.com/${this.apiVersion}/${wabaId}/subscribed_apps`;
      
      const response = await axios.post(url, {
        // Add messaging_product here as well
        messaging_product: 'whatsapp',
        access_token: accessToken,
        callback_url: webhookUrl,
        fields: [
          'messages', 
          'message_deliveries', 
          'messaging_postbacks', 
          'message_reads',
          'message_template_status_update'
        ],
        verify_token: config.env.meta.webhookVerifyToken,
      });
  
      return response.status === 200;
    } catch (error: any) {
      console.error('Error subscribing to webhooks:', error.response?.data || error.message);
      throw new Error(`Failed to subscribe to webhooks: ${error.response?.data?.error?.message || error.message}`);
    }
  }
  /**
   * Save WhatsApp details to database
   */
  async saveWhatsAppDetails(
    userId: string, 
    wabaId: string, 
    phoneNumberId: string, 
    accessToken: string,
    additionalDetails: {
        verified_name?: string;
        display_phone_number?: string;
      } = {}
    ): Promise<boolean> {
    try {
      // Save to Supabase
      const { error } = await supabase
        .from('whatsapp_accounts')
        .upsert({
          user_id: userId,
          waba_id: wabaId,
          phone_number_id: phoneNumberId,
          access_token: accessToken,
          verified_name: additionalDetails.verified_name,
          display_phone_number: additionalDetails.display_phone_number,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (error) {
        throw error;
      }

      return true;
    } catch (error: any) {
      console.error('Error saving WhatsApp details:', error);
      throw new Error(`Failed to save WhatsApp details: ${error.message}`);
    }
  }

  /**
   * Complete WhatsApp integration process
   */
  async completeIntegration(
    code: string, 
    userId: string, 
    wabaId: string, 
    phoneNumberId: string,
    customRedirectUri?: string
  ): Promise<boolean> {
    try {
      // Exchange code for token
      const tokenData = await this.exchangeCodeForToken(code, customRedirectUri);
      
      // Register phone number
      await this.registerPhoneNumber(tokenData.access_token, phoneNumberId);
      
      // Subscribe to webhooks
      await this.subscribeToWebhooks(tokenData.access_token, wabaId);
      
      // Save details
      await this.saveWhatsAppDetails(userId, wabaId, phoneNumberId, tokenData.access_token);
      
      return true;
    } catch (error: any) {
      console.error('Error completing WhatsApp integration:', error);
      throw error;
    }
  }

  /**
   * Get WhatsApp account details for a user
   */
  async getWhatsAppAccount(userId: string): Promise<WABAData | null> {
    try {
      const { data, error } = await supabase
        .from('whatsapp_accounts')
        .select('waba_id, phone_number_id, user_id, verified_name, display_phone_number, access_token')
        .eq('user_id', userId)
        .single();

      if (error) {
        throw error;
      }

      return data;
    } catch (error: any) {
      console.error('Error getting WhatsApp account:', error);
      return null;
    }
  }

  /**
   * Verify webhook subscription
   */
  verifyWebhook(mode: string, token: string, challenge: string): string | false {
    const verifyToken = config.env.meta.webhookVerifyToken;
    
    if (mode === 'subscribe' && token === verifyToken) {
      return challenge;
    }
    
    return false;
  }

  /**
   * Process webhook events
   */
  async processWebhookEvent(payload: any): Promise<boolean> {
    try {
      // Here you would process different types of webhook events
      // For example, saving messages to your database
      console.log('Received webhook event:', JSON.stringify(payload, null, 2));
      
      // Handle different event types
      if (payload.object === 'whatsapp_business_account') {
        // Process WhatsApp Business Account events
        const entries = payload.entry || [];
        
        for (const entry of entries) {
          const changes = entry.changes || [];
          
          for (const change of changes) {
            // Handle based on field
            if (change.field === 'messages') {
              await this.processMessageEvent(change.value);
            }
          }
        }
      }
      
      return true;
    } catch (error: any) {
      console.error('Error processing webhook event:', error);
      return false;
    }
  }


  

  /**
   * Process message events from webhook
   */
  private async processMessageEvent(value: any): Promise<void> {
    // Implement your logic to handle incoming messages
    // For example, store in database, trigger notifications, etc.
    const messages = value.messages || [];
    
    for (const message of messages) {
      console.log('Processing message:', message);
      
      // Here you would typically:
      // 1. Save the message to your database
      // 2. Notify any relevant users
      // 3. Process any commands or queries
    }
  }

  // Add this method to the WhatsAppService class
async sendWhatsAppMessage(
  userId: string, 
  messageOptions: WhatsAppMessageOptions
): Promise<{
  messageId: string;
  status: string;
}> {
  try {
    // Fetch user's WhatsApp account details
    const account = await this.getWhatsAppAccount(userId);

    if (!account) {
      throw new Error('No WhatsApp account found for this user');
    }

    // Construct message payload
    const messagePayload = this.constructMessagePayload(
      account.phone_number_id, 
      messageOptions
    );

    // Send message using Meta WhatsApp Cloud API
    const response = await axios.post(
      `https://graph.facebook.com/${this.apiVersion}/${account.phone_number_id}/messages`, 
      messagePayload,
      {
        headers: {
          'Authorization': `Bearer ${account.access_token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    // Return message ID and status
    return {
      messageId: response.data.messages?.[0]?.id || 'Unknown',
      status: 'sent'
    };
  } catch (error: any) {
    console.error('Error sending WhatsApp message:', error.response?.data || error.message);
    throw new Error(`Failed to send WhatsApp message: ${error.response?.data?.error?.message || error.message}`);
  }
}




// Helper method to construct message payload
private constructMessagePayload(
  phoneNumberId: string, 
  messageOptions: WhatsAppMessageOptions
) {
  const basePayload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: messageOptions.to
  };

  switch (messageOptions.type) {
    case 'text':
      return {
        ...basePayload,
        type: 'text',
        text: { body: messageOptions.content as string }
      };

    case 'template':
      return {
        ...basePayload,
        type: 'template',
        template: messageOptions.content
      };

    default:
      throw new Error('Unsupported message type');
  }
}


/**
 * Fetch phone numbers associated with the WhatsApp Business Account
 */
async fetchPhoneNumbers(accessToken: string): Promise<Array<{
  id: string;
  display_phone_number: string;
  verified_name: string;
  code_verification_status?: string;
  platform_type?: string;
}>> {
  try {
    const response = await axios.get(
      'https://graph.facebook.com/v22.0/me/businesses', 
      {
        params: {
          access_token: accessToken,
          fields: 'owned_whatsapp_business_accounts{phone_numbers{id,display_phone_number,verified_name,code_verification_status,platform_type}}'
        }
      }
    );

    // Initialize the array to hold phone numbers
    const phoneNumbers: Array<{
      id: string;
      display_phone_number: string;
      verified_name: string;
      code_verification_status?: string;
      platform_type?: string;
    }> = [];

    console.log('Full Phone Numbers Response:', JSON.stringify(response.data, null, 2));

    // Iterate over each business and then each WhatsApp business account
    response.data.data.forEach((business: any) => {
      if (business.owned_whatsapp_business_accounts?.data) {
        business.owned_whatsapp_business_accounts.data.forEach((account: any) => {
          if (account.phone_numbers?.data) {
            phoneNumbers.push(...account.phone_numbers.data);
          }
        });
      }
    });

    console.log('Fetched phone numbers:', JSON.stringify(phoneNumbers, null, 2));
    return phoneNumbers;
  } catch (error: any) {
    console.error('Error fetching phone numbers:', error.response?.data || error.message);
    throw new Error(
      `Failed to fetch phone numbers: ${error.response?.data?.error?.message || error.message}`
    );
  }
}




/**
 * Create a new phone number for the WhatsApp Business Account
 */
async createPhoneNumber(
  accessToken: string, 
  countryCode: string, 
  phoneNumber: string, 
  verifiedName: string
): Promise<{ id: string }> {
  try {
    // First, check existing phone numbers
    const businessesResponse = await axios.get(
      'https://graph.facebook.com/v22.0/me/businesses', 
      {
        params: {
          access_token: accessToken,
          fields: 'owned_whatsapp_business_accounts{phone_numbers{id,display_phone_number}}'
        }
      }
    );

    // Count and validate existing phone numbers
    const existingPhoneNumbers = businessesResponse.data.data.flatMap(
      (business: any) => 
        business.owned_whatsapp_business_accounts?.phone_numbers?.data || []
    );

    // Check phone number limit (default is 2)
    if (existingPhoneNumbers.length >= 2) {
      throw new Error('Maximum number of phone numbers (2) has been reached for this account');
    }

    // Check if phone number already exists
    const phoneNumberExists = existingPhoneNumbers.some(
      (pn: any) => pn.display_phone_number === `+${countryCode}${phoneNumber}`
    );

    if (phoneNumberExists) {
      throw new Error('This phone number is already registered');
    }

    // Extract the first WABA ID
    const wabaAccounts = businessesResponse.data.data.flatMap(
      (business: any) => 
        business.owned_whatsapp_business_accounts?.data || []
    );

    if (wabaAccounts.length === 0) {
      throw new Error('No WhatsApp Business Accounts found');
    }

    const wabaId = wabaAccounts[0].id;

    // Validate phone number format
    this.validatePhoneNumber(countryCode, phoneNumber);

    // Create phone number
    const response = await axios.post(
      `https://graph.facebook.com/v22.0/${wabaId}/phone_numbers`,
      {
        cc: countryCode,
        phone_number: phoneNumber,
        verified_name: verifiedName
      },
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return { id: response.data.id };
  } catch (error: any) {
    console.error('Detailed error creating phone number:', 
      JSON.stringify(error.response?.data || error, null, 2)
    );

    // More specific error handling
    if (error.response?.data?.error) {
      const errorDetails = error.response.data.error;
      
      // Map specific error codes
      const errorMap: { [key: number]: string } = {
        3095008: 'Cannot add phone number to WhatsApp Business Account. Check account verification status.',
        200000: 'General account configuration issue.',
        // Add more specific error code mappings as needed
      };

      const customMessage = errorMap[errorDetails.error_subcode] || errorDetails.message;
      
      throw new Error(customMessage);
    }

    throw error;
  }
}

// Phone number validation method
private validatePhoneNumber(countryCode: string, phoneNumber: string) {
  // Basic validation
  const fullPhoneNumber = `+${countryCode}${phoneNumber}`;
  
  // Check if the phone number is numeric
  if (!/^\d+$/.test(phoneNumber)) {
    throw new Error('Phone number must contain only digits');
  }

  // Basic length check (adjust as needed)
  if (phoneNumber.length < 7 || phoneNumber.length > 15) {
    throw new Error('Invalid phone number length');
  }

  // You can add more sophisticated validation as needed
}

/**
 * Request verification code for a phone number
 */

async requestPhoneNumberVerificationCode(
  accessToken: string, 
  phoneNumberId: string, 
  method: 'SMS' | 'VOICE' = 'SMS',
  language: string = 'en_US'
): Promise<boolean> {
  try {
    const response = await axios.post(
      `https://graph.facebook.com/v22.0/${phoneNumberId}/request_code`,
      null,
      {
        params: {
          code_method: method,
          language: language
        },
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );
    console.log('Verification code request response:', response.data);
    return response.data.success;
  } catch (error: any) {
    console.error('Error requesting verification code:', error.response?.data || error.message);
    throw new Error(`Failed to request verification code: ${error.response?.data?.error?.message || error.message}`);
  }
}




/**
 * Verify phone number with verification code
 */
// Method to verify phone number
async verifyPhoneNumber(
  accessToken: string, 
  phoneNumberId: string, 
  verificationCode: string
): Promise<boolean> {
  try {
    const response = await axios.post(
      `https://graph.facebook.com/v22.0/${phoneNumberId}/verify_code`,
      null,
      {
        params: {
          code: verificationCode.replace('-', '')
        },
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );
    console.log('Phone number verification response:', response.data);

    return response.data.success;
  } catch (error: any) {
    console.error('Error verifying phone number:', error.response?.data || error.message);
    throw new Error(`Failed to verify phone number: ${error.response?.data?.error?.message || error.message}`);
  }
}

// Method to check 2FA status
async checkTwoFactorAuthStatus(
  accessToken: string, 
  phoneNumberId: string
): Promise<boolean> {
  try {
    // Note: Meta doesn't provide a direct API to check 2FA status
    // This is a placeholder. In a real-world scenario, you might need 
    // to implement this through a different method or UI guidance
    return false;
  } catch (error: any) {
    console.error('Error checking 2FA status:', error);
    throw new Error('Failed to check two-factor authentication status');
  }
}


/**
 * Register verified phone number for Cloud API
 */
async registerPhoneNumberForCloudAPI(
  accessToken: string, 
  phoneNumberId: string, 
  pin?: string
): Promise<boolean> {
  try {
    const response = await axios.post(
      `https://graph.facebook.com/v22.0/${phoneNumberId}/register`,
      {
        messaging_product: 'whatsapp',
        ...(pin ? { pin } : {}) // Only include pin if provided
      },
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data.success;
  } catch (error: any) {
    console.error('Error registering phone number:', error.response?.data || error.message);
    throw new Error(`Failed to register phone number: ${error.response?.data?.error?.message || error.message}`);
  }
}
}
export default WhatsAppService;