// NotificationProvider.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { notificationService } from '../services/notificationService';

const NotificationContext = createContext({});

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    // 1. Get user profile and role
    const getProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      setProfile(profile);

      // Request notification permission once logged in
      notificationService.requestPermission();
    };

    getProfile();

    // 2. Setup Realtime Subscriptions
    const channel = supabase
      .channel('krantos-realtime')
      // A. New Lead Trigger (For Vendors and Admins)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'leads' },
        async (payload) => {
          const newLead = payload.new;
          
          if (profile?.role === 'super_admin' || profile?.role === 'admin') {
            notificationService.notify(
              'Nouveau Lead Krantos',
              `Un nouveau lead (${newLead.user_name}) a été généré depuis le calculateur.`
            );
          } else if (profile?.id) {
            // Check if this lead is assigned to this vendor
            const { data: vendor } = await supabase
              .from('vendors')
              .select('id')
              .eq('profile_id', profile.id)
              .single();
            
            if (vendor && newLead.vendor_id === vendor.id) {
              notificationService.notify(
                'Nouvelle Commande Lead',
                `Vous avez reçu un nouveau lead : ${newLead.user_name} (${newLead.location}).`
              );
            }
          }
        }
      )
      // B. New Vendor Registration (For Admins)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'vendors' },
        (payload) => {
          if (profile?.role === 'super_admin' || profile?.role === 'admin') {
            notificationService.notify(
              'Nouvelle Inscription Vendeur',
              `Le vendeur "${payload.new.name}" vient de s'inscrire sur la plateforme.`
            );
          }
        }
      )
      // C. Payment Reminder / Suspension (For Vendors)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'vendors' },
        (payload) => {
          if (profile?.id && payload.new.profile_id === profile.id) {
            const oldVal = payload.old.payment_notifications_count || 0;
            const newVal = payload.new.payment_notifications_count || 0;
            
            if (newVal > oldVal) {
              notificationService.notify(
                'Rappel de Paiement Commission',
                `Alerte : Rappel n°${newVal} envoyé. Merci de régulariser vos commissions pour éviter la suspension.`
              );
            }

            if (payload.new.status === 'suspended' && payload.old.status !== 'suspended') {
              notificationService.notify(
                'Compte Suspendu',
                'Votre compte a été suspendu pour défaut de paiement prolongé.',
                '/warning-icon.png'
              );
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id, profile?.role]);

  return (
    <NotificationContext.Provider value={{}}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => useContext(NotificationContext);
