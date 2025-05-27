// src/config/meta.ts

import { config } from "./index.js";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

// Meta App configuration
const metaAppId = config.env.meta.appId as string;
const metaAppSecret = config.env.meta.appSecret as string;
const metaRedirectUri = config.env.meta.redirectUri as string;
const metaApiVersion = config.env.meta.apiVersion as string;
const metaWhatsAppAuthConfig = config.env.meta.whatsappAuthConfig as string;

/**
 * Get WhatsApp Authorization URL
 * @param redirectUri - Optional custom redirect URI
 * @returns The URL to redirect users for WhatsApp authorization
 */
export const getWhatsAppAuthUrl = (redirectUri?: string): string => {
  const params = new URLSearchParams({
    client_id: metaAppId,
    config_id: metaWhatsAppAuthConfig,
    response_type: 'token',
    display: 'popup', 
    scope: 'whatsapp_business_management,whatsapp_business_messaging', 
    redirect_uri: redirectUri || metaRedirectUri,
  });

  return `https://www.facebook.com/${metaApiVersion}/dialog/oauth?${params.toString()}`;
};

/**
 * Exchange code for access token
 * @param code - The authorization code from Meta
 * @param redirectUri - Optional custom redirect URI
 * @returns Token data including access_token
 */
export const exchangeCodeForToken = async (code: string, redirectUri?: string) => {
  try {
    const params = new URLSearchParams({
      client_id: metaAppId,
      client_secret: metaAppSecret,
      redirect_uri: redirectUri || metaRedirectUri,
      code: code,
    });

    const url = `https://graph.facebook.com/${metaApiVersion}/oauth/access_token?${params.toString()}`;
    
    const response = await axios.get(url);
    return response.data;
  } catch (error: any) {
    console.error('Error exchanging code for token:', error.response?.data || error.message);
    throw new Error(`Failed to exchange code for token: ${error.response?.data?.error?.message || error.message}`);
  }
};

/**
 * Register a phone number for WhatsApp Cloud API
 * @param accessToken - Meta access token
 * @param phoneNumberId - WhatsApp phone number ID
 * @returns Boolean indicating success
 */
export const registerPhoneNumber = async (accessToken: string, phoneNumberId: string): Promise<boolean> => {
  try {
    const url = `https://graph.facebook.com/${metaApiVersion}/${phoneNumberId}/register`;
    
    const response = await axios.post(url, {}, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    return response.status === 200;
  } catch (error: any) {
    console.error('Error registering phone number:', error.response?.data || error.message);
    throw new Error(`Failed to register phone number: ${error.response?.data?.error?.message || error.message}`);
  }
};

/**
 * Subscribe to webhooks for a WhatsApp Business Account
 * @param accessToken - Meta access token
 * @param wabaId - WhatsApp Business Account ID
 * @returns Boolean indicating success
 */
export const subscribeToWebhooks = async (accessToken: string, wabaId: string): Promise<boolean> => {
  try {
    const webhookUrl = config.env.meta.webhookUrl;
    const verifyToken = config.env.meta.webhookVerifyToken;
    
    if (!webhookUrl || !verifyToken) {
      throw new Error('Webhook URL or verify token not configured');
    }

    const url = `https://graph.facebook.com/${metaApiVersion}/${wabaId}/subscribed_apps`;
    
    const response = await axios.post(url, {
      access_token: accessToken,
      callback_url: webhookUrl,
      fields: [
        'messages', 
        'message_deliveries', 
        'messaging_postbacks', 
        'message_reads',
        'message_template_status_update'
      ],
      verify_token: verifyToken,
    });

    return response.status === 200;
  } catch (error: any) {
    console.error('Error subscribing to webhooks:', error.response?.data || error.message);
    throw new Error(`Failed to subscribe to webhooks: ${error.response?.data?.error?.message || error.message}`);
  }
};

/**
 * Send a WhatsApp message
 * @param phoneNumberId - WhatsApp phone number ID
 * @param to - Recipient phone number with country code (e.g., 234812345678)
 * @param message - Message text content
 * @param accessToken - Meta access token
 * @returns Message ID if successful
 */
export const sendWhatsAppMessage = async (
  phoneNumberId: string,
  to: string,
  message: string,
  accessToken: string
): Promise<string> => {
  try {
    const url = `https://graph.facebook.com/${metaApiVersion}/${phoneNumberId}/messages`;
    
    const response = await axios.post(url, {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: to,
      type: "text",
      text: { 
        body: message 
      }
    }, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.data && response.data.messages && response.data.messages[0]) {
      return response.data.messages[0].id;
    }
    
    throw new Error('Failed to send WhatsApp message: No message ID returned');
  } catch (error: any) {
    console.error('Error sending WhatsApp message:', error.response?.data || error.message);
    throw new Error(`Failed to send WhatsApp message: ${error.response?.data?.error?.message || error.message}`);
  }
};

/**
 * Get information about a WhatsApp phone number
 * @param phoneNumberId - WhatsApp phone number ID
 * @param accessToken - Meta access token
 * @returns Phone number details
 */
export const getPhoneNumberInfo = async (phoneNumberId: string, accessToken: string) => {
  try {
    const url = `https://graph.facebook.com/${metaApiVersion}/${phoneNumberId}`;
    
    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    return response.data;
  } catch (error: any) {
    console.error('Error getting phone number info:', error.response?.data || error.message);
    throw new Error(`Failed to get phone number info: ${error.response?.data?.error?.message || error.message}`);
  }
};