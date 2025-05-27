// src/controllers/whatsapp.controller.ts

import { Request, Response } from 'express';
import WhatsAppService from '../services/whatsapp.service.js';

class WhatsAppController {
  private whatsappService: WhatsAppService;

  constructor() {
    this.whatsappService = new WhatsAppService();
  }

  /**
   * Get authorization URL for WhatsApp integration
   */
  async getAuthUrl(req: Request, res: Response) {
    try {
      const { redirect_uri } = req.query;
      
      const url = this.whatsappService.getAuthorizationUrl(redirect_uri as string);
      
      return res.status(200).json({
        status: true,
        data: { url }
      });
    } catch (error: any) {
      console.error('Error generating WhatsApp auth URL:', error);
      return res.status(500).json({
        status: false,
        msg: error.message || "An error occurred generating the WhatsApp auth URL"
      });
    }
  }

  /**
   * Complete WhatsApp integration with token-based flow
   */
  async completeTokenIntegration(req: Request, res: Response) {
    try {
      // Extract access token from request body
      const { access_token } = req.body;
      
      // Get user ID from authenticated request
      const userId = req.user?.id; // Ensure req.user is populated by middleware (extended in types)
      
      // Validate inputs
      if (!access_token) {
        return res.status(400).json({
          status: false,
          msg: 'Access token is required'
        });
      }
      
      if (!userId) {
        return res.status(401).json({
          status: false,
          msg: 'Authentication required'
        });
      }
      
      // Complete integration process
      const accountDetails = await this.whatsappService.completeTokenIntegration(
        access_token, 
        userId
      );
      
      // Successful response
      return res.status(200).json({
        status: true,
        msg: 'WhatsApp integration completed successfully',
        data: accountDetails
      });
    } catch (integrationError: any) {
      // Log the detailed error
      console.error('Integration error details:', integrationError);
      
      return res.status(400).json({
        status: false,
        msg: integrationError.message || 'Failed to complete WhatsApp integration',
        details: integrationError.response?.data
      });
    }
  } 
  


  /**
   * Exchange code for access token and complete integration
   */
  async completeIntegration(req: Request, res: Response) {
    try {
      const { code, waba_id, phone_number_id, redirect_uri } = req.body;
      
      if (!code) {
        return res.status(400).json({
          status: false,
          msg: 'Code is required'
        });
      }
      
      if (!waba_id) {
        return res.status(400).json({
          status: false,
          msg: 'WhatsApp Business Account ID is required'
        });
      }
      
      if (!phone_number_id) {
        return res.status(400).json({
          status: false,
          msg: 'Phone Number ID is required'
        });
      }
      
      // Get user ID from authenticated request
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({
          status: false,
          msg: 'Authentication required'
        });
      }
      
      // Complete integration process
      const success = await this.whatsappService.completeIntegration(
        code,
        userId,
        waba_id,
        phone_number_id,
        redirect_uri
      );
      
      if (success) {
        return res.status(200).json({
          status: true,
          msg: 'WhatsApp integration completed successfully'
        });
      } else {
        return res.status(500).json({
          status: false,
          msg: 'Failed to complete WhatsApp integration'
        });
      }
    } catch (error: any) {
      console.error('Error completing WhatsApp integration:', error);
      return res.status(500).json({
        status: false,
        msg: error.message || "An error occurred completing the WhatsApp integration"
      });
    }
  }

  /**
   * Exchange authorization code for access token only
   */
  async exchangeCode(req: Request, res: Response) {
    try {
      const { code, redirect_uri } = req.body;
      
      if (!code) {
        return res.status(400).json({
          status: false,
          msg: 'Code is required'
        });
      }
      
      const tokenData = await this.whatsappService.exchangeCodeForToken(code, redirect_uri);
      
      return res.status(200).json({
        status: true,
        data: tokenData
      });
    } catch (error: any) {
      console.error('Error exchanging code for token:', error);
      return res.status(500).json({
        status: false,
        msg: error.message || "An error occurred exchanging the code for a token"
      });
    }
  }

  /**
   * Get WhatsApp account details for the authenticated user
   */
  async getAccount(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({
          status: false,
          msg: 'Authentication required'
        });
      }
      
      const accountData = await this.whatsappService.getWhatsAppAccount(userId);
      
      if (accountData) {
        return res.status(200).json({
          status: true,
          data: {
            waba_id: accountData.waba_id,
            phone_number_id: accountData.phone_number_id,
            verified_name: accountData.verified_name, // Add this
            display_phone_number: accountData.display_phone_number // Add this
          }
        });
      } else {
        return res.status(404).json({
          status: false,
          msg: 'No WhatsApp account found for this user'
        });
      }
    } catch (error: any) {
      console.error('Error getting WhatsApp account:', error);
      return res.status(500).json({
        status: false,
        msg: error.message || "An error occurred retrieving the WhatsApp account details"
      });
    }
  }
  /**
   * Handle webhook verification
   */
  handleWebhookVerification(req: Request, res: Response) {
    try {
      const mode = req.query['hub.mode'] as string;
      const token = req.query['hub.verify_token'] as string;
      const challenge = req.query['hub.challenge'] as string;
      
      const result = this.whatsappService.verifyWebhook(mode, token, challenge);
      
      if (result !== false) {
        return res.status(200).send(result);
      } else {
        return res.status(403).send('Verification failed');
      }
    } catch (error: any) {
      console.error('Error verifying webhook:', error);
      return res.status(500).send('Error');
    }
  }

  /**
   * Handle webhook events
   */
  async handleWebhookEvent(req: Request, res: Response) {
    try {
      const payload = req.body;
      
      // Process the event asynchronously
      this.whatsappService.processWebhookEvent(payload)
        .catch(error => console.error('Error processing webhook event:', error));
      
      // Return 200 OK immediately to acknowledge receipt
      return res.status(200).send('EVENT_RECEIVED');
    } catch (error: any) {
      console.error('Error handling webhook event:', error);
      return res.status(500).send('Error');
    }
  }

  async sendMessage(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({
          status: false,
          msg: 'Authentication required'
        });
      }
  
      const { 
        to, 
        type = 'text', 
        content 
      } = req.body;
  
      // Validate inputs
      if (!to) {
        return res.status(400).json({
          status: false,
          msg: 'Recipient phone number is required'
        });
      }
  
      if (!content) {
        return res.status(400).json({
          status: false,
          msg: 'Message content is required'
        });
      }
  
      // Send message
      const result = await this.whatsappService.sendWhatsAppMessage(
        userId, 
        { to, type, content }
      );
  
      return res.status(200).json({
        status: true,
        msg: 'Message sent successfully',
        data: result
      });
    } catch (error: any) {
      console.error('Error sending WhatsApp message:', error);
      return res.status(500).json({
        status: false,
        msg: error.message || 'Failed to send WhatsApp message'
      });
    }
  }

  // Add these methods to the WhatsAppController class

/**
 * Fetch phone numbers for the current user
 */
async getPhoneNumbers(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        status: false,
        msg: 'Authentication required'
      });
    }

    // Fetch user's WhatsApp account to get access token
    const account = await this.whatsappService.getWhatsAppAccount(userId);
    
    if (!account) {
      return res.status(404).json({
        status: false,
        msg: 'No WhatsApp account found'
      });
    }

    // Fetch phone numbers (this method now properly handles the nested structure)
    const phoneNumbers = await this.whatsappService.fetchPhoneNumbers(account.access_token);
    console.log('Fetched phone numbers:', phoneNumbers);

    // Map out the phone numbers to return only the desired fields
    return res.status(200).json({
      status: true,
      data: phoneNumbers.map(number => ({
        id: number.id,
        display_phone_number: number.display_phone_number,
        verified_name: number.verified_name,
        verification_status: number.code_verification_status,
        platform_type: number.platform_type
      }))
    });
  } catch (error: any) {
    console.error('Error fetching phone numbers:', error);
    return res.status(500).json({
      status: false,
      msg: error.message || 'Failed to fetch phone numbers'
    });
  }
}


// Method to request verification code
async requestVerificationCode(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    const { phone_number_id } = req.body;

    if (!userId) {
      return res.status(401).json({
        status: false,
        msg: 'Authentication required'
      });
    }

    // Fetch user's WhatsApp account to get access token
    const account = await this.whatsappService.getWhatsAppAccount(userId);
    
    if (!account) {
      return res.status(404).json({
        status: false,
        msg: 'No WhatsApp account found'
      });
    }

    // Request verification code
    const success = await this.whatsappService.requestPhoneNumberVerificationCode(
      account.access_token, 
      phone_number_id
    );

    return res.status(200).json({
      status: true,
      msg: 'Verification code sent successfully',
      data: { success }
    });
  } catch (error: any) {
    console.error('Error requesting verification code:', error);
    return res.status(500).json({
      status: false,
      msg: error.message || 'Failed to request verification code'
    });
  }
}

/**
 * Create and register a new phone number
 */
async registerPhoneNumber(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    const { 
      country_code, 
      phone_number, 
      verified_name 
    } = req.body;

    if (!userId) {
      return res.status(401).json({
        status: false,
        msg: 'Authentication required'
      });
    }

    // Validate input
    if (!country_code || !phone_number || !verified_name) {
      return res.status(400).json({
        status: false,
        msg: 'Country code, phone number, and verified name are required'
      });
    }

    // Fetch user's WhatsApp account to get access token
    const account = await this.whatsappService.getWhatsAppAccount(userId);
    
    if (!account) {
      return res.status(404).json({
        status: false,
        msg: 'No WhatsApp account found'
      });
    }

    try {
      // Create phone number
      const { id: phoneNumberId } = await this.whatsappService.createPhoneNumber(
        account.access_token,
        country_code,
        phone_number,
        verified_name
      );

      // Request verification code
      await this.whatsappService.requestPhoneNumberVerificationCode(
        account.access_token, 
        phoneNumberId
      );

      return res.status(200).json({
        status: true,
        msg: 'Phone number created. Verification code sent.',
        data: { phone_number_id: phoneNumberId }
      });
    } catch (createError: any) {
      console.error('Phone number creation error:', createError);
      
      return res.status(400).json({
        status: false,
        msg: createError.message || 'Failed to register phone number',
        details: createError.response?.data
      });
    }
  } catch (error: any) {
    console.error('Error registering phone number:', error);
    return res.status(500).json({
      status: false,
      msg: 'Internal server error',
      details: error.message
    });
  }
}
/**
 * Verify phone number with verification code
 */
async verifyPhoneNumber(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    const { phone_number_id, verification_code } = req.body;

    if (!userId) {
      return res.status(401).json({
        status: false,
        msg: 'Authentication required'
      });
    }

    // Fetch user's WhatsApp account to get access token
    const account = await this.whatsappService.getWhatsAppAccount(userId);
    
    if (!account) {
      return res.status(404).json({
        status: false,
        msg: 'No WhatsApp account found'
      });
    }

    // Verify phone number
    const verified = await this.whatsappService.verifyPhoneNumber(
      account.access_token, 
      phone_number_id, 
      verification_code
    );

    // Check 2FA status
    const isTwoFactorEnabled = await this.whatsappService.checkTwoFactorAuthStatus(
      account.access_token, 
      phone_number_id
    );

    return res.status(200).json({
      status: true,
      msg: 'Phone number verified successfully',
      data: { 
        verified, 
        two_factor_enabled: isTwoFactorEnabled 
      }
    });
  } catch (error: any) {
    console.error('Error verifying phone number:', error);
    return res.status(500).json({
      status: false,
      msg: error.message || 'Failed to verify phone number'
    });
  }
}

async registerForCloudAPI(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    const { phone_number_id, two_factor_pin } = req.body;

    if (!userId) {
      return res.status(401).json({
        status: false,
        msg: 'Authentication required'
      });
    }

    // Fetch user's WhatsApp account to get access token
    const account = await this.whatsappService.getWhatsAppAccount(userId);
    
    if (!account) {
      return res.status(404).json({
        status: false,
        msg: 'No WhatsApp account found'
      });
    }

    // Register for Cloud API
    const registered = await this.whatsappService.registerPhoneNumberForCloudAPI(
      account.access_token, 
      phone_number_id,
      two_factor_pin
    );

    return res.status(200).json({
      status: true,
      msg: 'Phone number registered for Cloud API successfully',
      data: { registered }
    });
  } catch (error: any) {
    console.error('Error registering for Cloud API:', error);
    return res.status(500).json({
      status: false,
      msg: error.message || 'Failed to register for Cloud API'
    });
  }
}
   
}

export default WhatsAppController;


// // src/controllers/whatsapp.controller.ts

// import { Request, Response } from 'express';
// import WhatsAppService from '../services/whatsapp.service.js';

// class WhatsAppController {
//   private whatsappService: WhatsAppService;

//   constructor() {
//     this.whatsappService = new WhatsAppService();
//   }

//   /**
//    * Get authorization URL for WhatsApp integration
//    */
//   async getAuthUrl(req: Request, res: Response) {
//     try {
//       const { redirect_uri } = req.query;
      
//       const url = this.whatsappService.getAuthorizationUrl(redirect_uri as string);
      
//       return res.status(200).json({
//         status: true,
//         data: { url }
//       });
//     } catch (error: any) {
//       console.error('Error generating WhatsApp auth URL:', error);
//       return res.status(500).json({
//         status: false,
//         msg: error.message || "An error occurred generating the WhatsApp auth URL"
//       });
//     }
//   }

//   /**
//    * Exchange code for access token and complete integration
//    */
//   async completeIntegration(req: Request, res: Response) {
//     try {
//       const { code, waba_id, phone_number_id, redirect_uri } = req.body;
      
//       if (!code) {
//         return res.status(400).json({
//           status: false,
//           msg: 'Code is required'
//         });
//       }
      
//       if (!waba_id) {
//         return res.status(400).json({
//           status: false,
//           msg: 'WhatsApp Business Account ID is required'
//         });
//       }
      
//       if (!phone_number_id) {
//         return res.status(400).json({
//           status: false,
//           msg: 'Phone Number ID is required'
//         });
//       }
      
//       // Get user ID from authenticated request
//       const userId = req.user?.id;
      
//       if (!userId) {
//         return res.status(401).json({
//           status: false,
//           msg: 'Authentication required'
//         });
//       }
      
//       // Complete integration process
//       const success = await this.whatsappService.completeIntegration(
//         code,
//         userId,
//         waba_id,
//         phone_number_id,
//         redirect_uri
//       );
      
//       if (success) {
//         return res.status(200).json({
//           status: true,
//           msg: 'WhatsApp integration completed successfully'
//         });
//       } else {
//         return res.status(500).json({
//           status: false,
//           msg: 'Failed to complete WhatsApp integration'
//         });
//       }
//     } catch (error: any) {
//       console.error('Error completing WhatsApp integration:', error);
//       return res.status(500).json({
//         status: false,
//         msg: error.message || "An error occurred completing the WhatsApp integration"
//       });
//     }
//   }

//   /**
//    * Exchange authorization code for access token only
//    */
//   async exchangeCode(req: Request, res: Response) {
//     try {
//       const { code, redirect_uri } = req.body;
      
//       if (!code) {
//         return res.status(400).json({
//           status: false,
//           msg: 'Code is required'
//         });
//       }
      
//       const tokenData = await this.whatsappService.exchangeCodeForToken(code, redirect_uri);
      
//       return res.status(200).json({
//         status: true,
//         data: tokenData
//       });
//     } catch (error: any) {
//       console.error('Error exchanging code for token:', error);
//       return res.status(500).json({
//         status: false,
//         msg: error.message || "An error occurred exchanging the code for a token"
//       });
//     }
//   }

//   /**
//    * Get WhatsApp account details for the authenticated user
//    */
//   async getAccount(req: Request, res: Response) {
//     try {
//       // Get user ID from authenticated request
//       const userId = req.user?.id;
      
//       if (!userId) {
//         return res.status(401).json({
//           status: false,
//           msg: 'Authentication required'
//         });
//       }
      
//       const accountData = await this.whatsappService.getWhatsAppAccount(userId);
      
//       if (accountData) {
//         return res.status(200).json({
//           status: true,
//           data: accountData
//         });
//       } else {
//         return res.status(404).json({
//           status: false,
//           msg: 'No WhatsApp account found for this user'
//         });
//       }
//     } catch (error: any) {
//       console.error('Error getting WhatsApp account:', error);
//       return res.status(500).json({
//         status: false,
//         msg: error.message || "An error occurred retrieving the WhatsApp account details"
//       });
//     }
//   }

//   /**
//    * Handle webhook verification
//    */
//   handleWebhookVerification(req: Request, res: Response) {
//     try {
//       const mode = req.query['hub.mode'] as string;
//       const token = req.query['hub.verify_token'] as string;
//       const challenge = req.query['hub.challenge'] as string;
      
//       const result = this.whatsappService.verifyWebhook(mode, token, challenge);
      
//       if (result !== false) {
//         return res.status(200).send(result);
//       } else {
//         return res.status(403).send('Verification failed');
//       }
//     } catch (error: any) {
//       console.error('Error verifying webhook:', error);
//       return res.status(500).send('Error');
//     }
//   }

//   /**
//    * Handle webhook events
//    */
//   async handleWebhookEvent(req: Request, res: Response) {
//     try {
//       const payload = req.body;
      
//       // Process the event asynchronously
//       this.whatsappService.processWebhookEvent(payload)
//         .catch(error => console.error('Error processing webhook event:', error));
      
//       // Return 200 OK immediately to acknowledge receipt
//       return res.status(200).send('EVENT_RECEIVED');
//     } catch (error: any) {
//       console.error('Error handling webhook event:', error);
//       return res.status(500).send('Error');
//     }
//   }
// }

// export default WhatsAppController;