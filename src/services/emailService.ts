import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

/**
 * Service to handle email notifications for the Krantos platform.
 * Integrates with Resend via Supabase Edge Functions.
 */
export const EmailService = {
  /**
   * Sends a validation email to a vendor when their account is activated.
   */
  async sendValidationEmail(vendorName: string, vendorEmail: string): Promise<void> {
    console.log(`[EmailService] Sending validation email to ${vendorName} (${vendorEmail})...`);
    
    try {
      const { error } = await supabase.functions.invoke('send-email', {
        body: { 
          to: vendorEmail,
          subject: 'Bienvenue sur Krantos ! Votre compte est activé',
          html: `
            <div style="font-family: sans-serif; color: #1a1a1a; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
              <h2 style="color: #eab308;">Félicitations ${vendorName} !</h2>
              <p>Nous avons le plaisir de vous informer que votre compte vendeur sur <strong>Krantos</strong> a été validé par notre équipe.</p>
              <p>Vous pouvez dès à présent vous connecter à votre espace business pour gérer vos produits et suivre vos leads :</p>
              <div style="margin: 30px 0;">
                <a href="https://krantos.vercel.app/business-login" style="background-color: #eab308; color: #000; padding: 15px 25px; text-decoration: none; border-radius: 8px; font-weight: bold;">Accéder à mon tableau de bord</a>
              </div>
              <p style="color: #666; font-size: 14px;">Si vous avez des questions, n'hésitez pas à nous contacter.</p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
              <p style="font-size: 12px; color: #999;">L'équipe Krantos</p>
            </div>
          `
        }
      });

      if (error) throw error;

      toast.success(`Email de validation envoyé à ${vendorEmail}`);
    } catch (err) {
      console.error('Failed to send email:', err);
      toast.error('Erreur lors de l\'envoi de l\'email de validation.');
    }
  },

  /**
   * Sends a suspension email to a vendor.
   */
  async sendSuspensionEmail(vendorName: string, vendorEmail: string): Promise<void> {
    console.log(`[EmailService] Sending suspension email to ${vendorName} (${vendorEmail})...`);
    
    try {
      const { error } = await supabase.functions.invoke('send-email', {
        body: { 
          to: vendorEmail,
          subject: 'Information importante concernant votre compte Krantos',
          html: `
            <div style="font-family: sans-serif; color: #1a1a1a; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
              <h2 style="color: #ef4444;">Compte suspendu</h2>
              <p>Bonjour ${vendorName},</p>
              <p>Nous vous informons que votre compte vendeur sur <strong>Krantos</strong> a été suspendu temporairement.</p>
              <p>Pour plus d'informations ou pour régulariser votre situation, veuillez contacter l'administration.</p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
              <p style="font-size: 12px; color: #999;">L'équipe Krantos</p>
            </div>
          `
        }
      });

      if (error) throw error;
      toast.warning(`Email de suspension envoyé à ${vendorEmail}`);
    } catch (err) {
      console.error('Failed to send email:', err);
      // Fallback notification
    }
  }
};

