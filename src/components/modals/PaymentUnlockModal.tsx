import React, { useState, useMemo } from 'react';
import {
  X,
  Crown,
  CheckCircle2,
  Copy,
  Check,
  CreditCard,
  QrCode,
  ShieldCheck,
  Sparkles,
  Lock,
  ArrowRight,
  Zap,
  Building,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency } from '../../utils/formatters';
import { generatePixPayload } from '../../utils/pixPayload';

interface PaymentUnlockModalProps {
  isOpen: boolean;
  onClose: () => void;
  reason?: 'expired' | 'voluntary';
}

export const PaymentUnlockModal: React.FC<PaymentUnlockModalProps> = ({
  isOpen,
  onClose,
  reason = 'voluntary',
}) => {
  const { gatewaySettings, processLifetimePayment, currentUser, userProfile } = useAuth();

  const [paymentMethod, setPaymentMethod] = useState<'PIX' | 'CREDIT_CARD'>('PIX');
  const [selectedGateway, setSelectedGateway] = useState<'MERCADO_PAGO' | 'STONE' | 'PIX_DIRECT'>(
    'PIX_DIRECT'
  );
  const [copied, setCopied] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [successResult, setSuccessResult] = useState<string | null>(null);

  // Credit Card Form State
  const [cardNumber, setCardNumber] = useState('');
  const [cardHolder, setCardHolder] = useState(userProfile?.displayName || '');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [installments, setInstallments] = useState(1);

  // Lifetime Price defined by Super Admin
  const lifetimePrice = gatewaySettings.lifetimePrice || 97.0;

  // Generate PIX BR Code Payload
  const pixPayload = useMemo(() => {
    return generatePixPayload({
      key: gatewaySettings.pixKey || 'osaiasbrito@gmail.com',
      beneficiaryName: gatewaySettings.pixBeneficiaryName || 'Meu Controle Financeiro',
      beneficiaryCity: gatewaySettings.pixCity || 'SAO PAULO',
      amount: lifetimePrice,
      txId: `CF${Date.now().toString().slice(-10)}`,
      description: 'Acesso Vitalicio Meu Controle Financeiro',
    });
  }, [gatewaySettings, lifetimePrice]);

  if (!isOpen) return null;

  const handleCopyPix = () => {
    navigator.clipboard.writeText(pixPayload);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleConfirmPixPayment = async () => {
    setProcessing(true);
    try {
      const res = await processLifetimePayment({
        amount: lifetimePrice,
        gateway: selectedGateway,
        method: 'PIX',
        transactionId: `pix_${Date.now()}`,
        details: `Pagamento PIX para ${gatewaySettings.pixKey}`,
      });
      setSuccessResult(res.message);
      setTimeout(() => {
        onClose();
        setSuccessResult(null);
      }, 2500);
    } catch (err: any) {
      alert(err.message || 'Erro ao processar pagamento.');
    } finally {
      setProcessing(false);
    }
  };

  const handleCreditCardPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cardNumber.replace(/\s/g, '').length < 13) {
      alert('Por favor, informe um número de cartão válido.');
      return;
    }

    setProcessing(true);
    try {
      const activeGateway = gatewaySettings.mercadoPagoEnabled
        ? 'MERCADO_PAGO'
        : gatewaySettings.stoneEnabled
        ? 'STONE'
        : 'MERCADO_PAGO';

      const res = await processLifetimePayment({
        amount: lifetimePrice,
        gateway: activeGateway,
        method: 'CREDIT_CARD',
        cardLastFour: cardNumber.slice(-4),
        installments,
        transactionId: `cc_${Date.now()}`,
        details: `Cartão de crédito aprovado via ${activeGateway}`,
      });

      setSuccessResult(res.message);
      setTimeout(() => {
        onClose();
        setSuccessResult(null);
      }, 2500);
    } catch (err: any) {
      alert(err.message || 'Erro ao processar cobrança.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/90 max-w-2xl w-full overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-linear-to-r from-slate-900 via-slate-800 to-emerald-950 p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute right-5 top-5 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full bg-amber-400/20 border border-amber-400/30 text-amber-300 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
              <Crown className="w-3.5 h-3.5 text-amber-400" />
              Liberação Definitiva & Total
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            {reason === 'expired'
              ? 'Seu período de teste de 30 dias chegou ao fim'
              : 'Desbloqueie o Acesso Vitalício por tempo indeterminado'}
          </h2>

          <p className="text-xs text-slate-300 mt-1 max-w-xl">
            Pague apenas uma taxa única fixada pelo Super Usuário de{' '}
            <strong className="text-emerald-300 font-bold">{formatCurrency(lifetimePrice)}</strong> e
            tenha acesso total, permanente e sem mensalidades para sempre.
          </p>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {successResult ? (
            <div className="py-12 text-center space-y-4">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-black text-slate-900">
                Acesso Vitalício Liberado com Sucesso!
              </h3>
              <p className="text-xs text-slate-600 max-w-md mx-auto">{successResult}</p>
              <div className="inline-flex items-center gap-1 text-xs text-emerald-700 font-bold bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-200">
                <Sparkles className="w-4 h-4" /> Agora você pode lançar dados sem nenhuma restrição!
              </div>
            </div>
          ) : (
            <>
              {/* Method Selector Tabs */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('PIX')}
                  className={`p-3.5 rounded-2xl border-2 flex items-center gap-3 transition-all cursor-pointer ${
                    paymentMethod === 'PIX'
                      ? 'border-emerald-500 bg-emerald-50/50 text-emerald-950 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 text-slate-600'
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold ${
                      paymentMethod === 'PIX'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    <QrCode className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <span className="text-xs font-black block">PIX Instantâneo</span>
                    <span className="text-[10px] text-slate-400 font-medium">
                      Liberação Automática Imediata
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('CREDIT_CARD')}
                  className={`p-3.5 rounded-2xl border-2 flex items-center gap-3 transition-all cursor-pointer ${
                    paymentMethod === 'CREDIT_CARD'
                      ? 'border-emerald-500 bg-emerald-50/50 text-emerald-950 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 text-slate-600'
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold ${
                      paymentMethod === 'CREDIT_CARD'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <span className="text-xs font-black block">Cartão de Crédito</span>
                    <span className="text-[10px] text-slate-400 font-medium">
                      Mercado Pago / Stone (até 12x)
                    </span>
                  </div>
                </button>
              </div>

              {/* PIX TAB */}
              {paymentMethod === 'PIX' && (
                <div className="space-y-4 bg-slate-50 p-5 rounded-2xl border border-slate-200">
                  <div className="flex flex-col sm:flex-row items-center gap-6">
                    {/* Simulated visual QR Code with standard styling */}
                    <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col items-center shrink-0">
                      <div className="w-36 h-36 bg-slate-900 rounded-xl p-2.5 flex flex-col justify-between relative overflow-hidden">
                        {/* QR Code decorative grid patterns */}
                        <div className="grid grid-cols-6 gap-1 w-full h-full">
                          {Array.from({ length: 36 }).map((_, i) => (
                            <div
                              key={i}
                              className={`rounded-xs ${
                                (i % 2 === 0 || i % 7 === 0 || i < 6 || i > 30)
                                  ? 'bg-white'
                                  : 'bg-slate-900'
                              }`}
                            />
                          ))}
                        </div>
                        <div className="absolute inset-0 m-auto w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center text-slate-950 font-black text-xs shadow-md">
                          PIX
                        </div>
                      </div>
                      <span className="text-[10px] text-slate-400 font-bold mt-2">
                        Escaneie no App do seu Banco
                      </span>
                    </div>

                    {/* PIX Beneficiary Information */}
                    <div className="flex-1 space-y-2 text-xs">
                      <div className="flex justify-between border-b border-slate-200/80 pb-1.5">
                        <span className="text-slate-500 font-medium">Valor da Taxa:</span>
                        <span className="font-black text-slate-900 text-sm">
                          {formatCurrency(lifetimePrice)}
                        </span>
                      </div>

                      <div className="flex justify-between border-b border-slate-200/80 pb-1.5">
                        <span className="text-slate-500 font-medium">Chave PIX:</span>
                        <span className="font-bold text-slate-900 font-mono text-[11px]">
                          {gatewaySettings.pixKey || 'osaiasbrito@gmail.com'}
                        </span>
                      </div>

                      <div className="flex justify-between border-b border-slate-200/80 pb-1.5">
                        <span className="text-slate-500 font-medium">Beneficiário:</span>
                        <span className="font-bold text-slate-800">
                          {gatewaySettings.pixBeneficiaryName || 'Meu Controle Financeiro'}
                        </span>
                      </div>

                      <div className="flex justify-between">
                        <span className="text-slate-500 font-medium">Banco / Cidade:</span>
                        <span className="font-medium text-slate-700">
                          {gatewaySettings.pixBankName || 'Stone / Mercado Pago'} -{' '}
                          {gatewaySettings.pixCity || 'SAO PAULO'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Pix Copia e Cola */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Código PIX Copia e Cola
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        readOnly
                        value={pixPayload}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-600 truncate"
                      />
                      <button
                        type="button"
                        onClick={handleCopyPix}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
                      >
                        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        <span>{copied ? 'Copiado!' : 'Copiar'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Confirmation Button */}
                  <button
                    type="button"
                    disabled={processing}
                    onClick={handleConfirmPixPayment}
                    className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {processing ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Zap className="w-4 h-4 text-emerald-400" />
                        <span>Já realizei o pagamento / Confirmar Liberação Imediata</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* CREDIT CARD TAB */}
              {paymentMethod === 'CREDIT_CARD' && (
                <form
                  onSubmit={handleCreditCardPayment}
                  className="space-y-3.5 bg-slate-50 p-5 rounded-2xl border border-slate-200"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                    <span className="text-xs font-bold text-slate-700">
                      Gateway de Processamento:{' '}
                      <strong className="text-emerald-700">
                        {gatewaySettings.mercadoPagoEnabled
                          ? 'Mercado Pago'
                          : gatewaySettings.stoneEnabled
                          ? 'Stone / Pagar.me'
                          : 'Mercado Pago'}
                      </strong>
                    </span>
                    <span className="text-xs font-black text-slate-900">
                      {formatCurrency(lifetimePrice)}
                    </span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Número do Cartão de Crédito
                    </label>
                    <div className="relative">
                      <CreditCard className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required
                        placeholder="0000 0000 0000 0000"
                        maxLength={19}
                        value={cardNumber}
                        onChange={(e) => setCardNumber(e.target.value)}
                        className="w-full pl-10 pr-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono font-medium text-slate-900"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Nome Impresso no Cartão
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="NOME COMPLETO COMO NO CARTAO"
                      value={cardHolder}
                      onChange={(e) => setCardHolder(e.target.value.toUpperCase())}
                      className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Validade (MM/AA)
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="MM/AA"
                        maxLength={5}
                        value={expiry}
                        onChange={(e) => setExpiry(e.target.value)}
                        className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono text-center font-medium text-slate-900"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Código CVV
                      </label>
                      <input
                        type="password"
                        required
                        placeholder="123"
                        maxLength={4}
                        value={cvv}
                        onChange={(e) => setCvv(e.target.value)}
                        className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono text-center font-medium text-slate-900"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Parcelamento
                    </label>
                    <select
                      value={installments}
                      onChange={(e) => setInstallments(parseInt(e.target.value))}
                      className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                    >
                      <option value={1}>1x de {formatCurrency(lifetimePrice)} (À vista)</option>
                      <option value={2}>2x de {formatCurrency(lifetimePrice / 2)}</option>
                      <option value={3}>3x de {formatCurrency(lifetimePrice / 3)}</option>
                      <option value={6}>6x de {formatCurrency(lifetimePrice / 6)}</option>
                      <option value={12}>12x de {formatCurrency(lifetimePrice / 12)}</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={processing}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {processing ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Lock className="w-4 h-4" />
                        <span>Pagar {formatCurrency(lifetimePrice)} & Liberar Vitalício</span>
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* Guarantees */}
              <div className="grid grid-cols-2 gap-3 text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Ambiente 100% Criptografado</span>
                </div>
                <div className="flex items-center gap-2">
                  <Crown className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>Acesso por tempo indeterminado</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
