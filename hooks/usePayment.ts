import { useState, useCallback, useRef } from 'react';
import { api } from '../services/api';

interface PaymentState {
  loading: boolean;
  paymentUrl: string | null;
  showWebView: boolean;
  showCreditModal: boolean;
}

interface UsePaymentReturn {
  loading: boolean;
  paymentUrl: string | null;
  showWebView: boolean;
  showCreditModal: boolean;
  initiatePayment: (price: string, credits: number, currency?: string) => Promise<void>;
  handlePaymentSuccess: () => void;
  handlePaymentFailure: (error?: string) => void;
  closeWebView: () => void;
  setShowCreditModal: (visible: boolean) => void;
  refreshOnSuccess: () => void;
}

export function usePayment(onRefresh?: () => void): UsePaymentReturn {
  const [state, setState] = useState<PaymentState>({
    loading: false,
    paymentUrl: null,
    showWebView: false,
    showCreditModal: false,
  });

  const pendingCreditsRef = useRef(0);

  const initiatePayment = useCallback(async (price: string, credits: number, currency = 'TRY') => {
    setState(prev => ({ ...prev, loading: true }));
    try {
      const result = await api.createPayment(price, credits, currency);
      pendingCreditsRef.current = credits;
      setState(prev => ({
        ...prev,
        loading: false,
        paymentUrl: result.paymentUrl,
        showWebView: true,
        showCreditModal: false,
      }));
    } catch (err) {
      setState(prev => ({ ...prev, loading: false }));
      throw err;
    }
  }, []);

  const handlePaymentSuccess = useCallback(() => {
    setState(prev => ({ ...prev, showWebView: false, paymentUrl: null }));
    onRefresh?.();
  }, [onRefresh]);

  const handlePaymentFailure = useCallback((_error?: string) => {
    setState(prev => ({ ...prev, showWebView: false, paymentUrl: null }));
  }, []);

  const closeWebView = useCallback(() => {
    setState(prev => ({ ...prev, showWebView: false, paymentUrl: null }));
  }, []);

  const setShowCreditModal = useCallback((visible: boolean) => {
    setState(prev => ({ ...prev, showCreditModal: visible }));
  }, []);

  const refreshOnSuccess = useCallback(() => {
    onRefresh?.();
  }, [onRefresh]);

  return {
    loading: state.loading,
    paymentUrl: state.paymentUrl,
    showWebView: state.showWebView,
    showCreditModal: state.showCreditModal,
    initiatePayment,
    handlePaymentSuccess,
    handlePaymentFailure,
    closeWebView,
    setShowCreditModal,
    refreshOnSuccess,
  };
}
