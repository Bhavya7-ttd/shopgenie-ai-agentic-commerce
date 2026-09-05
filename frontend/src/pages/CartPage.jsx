import React, { useState, useEffect } from 'react';
import { ShoppingCart, Plus, Minus, Trash2, ArrowRight, Bot, Sparkles, CheckCircle2, XCircle, AlertTriangle, CreditCard, Lock, History, RefreshCw, X, ShieldCheck } from 'lucide-react';
import { cartAPI, paymentAPI } from '../services/api';
import ProductImage from '../components/ProductImage';

export default function CartPage({ cart, updateCart, setCurrentPage, setAgentPrompt }) {
  const [loadingId, setLoadingId] = useState(null);
  const [checkingOut, setCheckingOut] = useState(false);
  const [orderModal, setOrderModal] = useState(null);
  const [orderAuditTrail, setOrderAuditTrail] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    async function loadHistory() {
      try {
        setLoadingHistory(true);
        const orders = await paymentAPI.getOrders();
        setOrderAuditTrail(orders);
      } catch (err) {
        console.error("Error loading payment history:", err);
      } finally {
        setLoadingHistory(false);
      }
    }
    loadHistory();
  }, []);

  const handleUpdateQuantity = async (productId, currentQty, delta) => {
    const nextQty = currentQty + delta;
    try {
      setLoadingId(productId);
      const updated = await cartAPI.update(productId, nextQty);
      updateCart(updated);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingId(null);
    }
  };

  const handleRemoveItem = async (productId) => {
    try {
      setLoadingId(productId);
      const updated = await cartAPI.remove(productId);
      updateCart(updated);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingId(null);
    }
  };

  const handleClearCart = async () => {
    try {
      const updated = await cartAPI.clear();
      updateCart(updated);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSuggestionAction = () => {
    let prompt = "Suggest accessories for my cart";
    const sug = (cart.ai_suggestion || '').toLowerCase();

    if (sug.includes("keyboard")) {
      prompt = "Find a compatible bluetooth keyboard like Logitech K380 under ₹3,000";
    } else if (sug.includes("mouse")) {
      prompt = "Find a wireless mouse like Logitech B170 under ₹1,000";
    } else if (sug.includes("face wash") || sug.includes("cleanser")) {
      prompt = "Find Plum Green Tea face wash under ₹500";
    } else if (sug.includes("fitness tracker") || sug.includes("watch")) {
      prompt = "Find the best fitness tracker smartwatch under ₹3,000";
    } else if (sug.includes("bottle")) {
      prompt = "Find Milton insulated hot and cold water bottle under ₹1,500";
    }

    setAgentPrompt(prompt);
    setCurrentPage('agent');
  };

  const handleCheckout = async () => {
    if (!window.Razorpay) {
      alert("Razorpay Checkout script (checkout.js) could not be loaded. Please check your internet connection or adblocker settings and refresh the page.");
      return;
    }

    try {
      setCheckingOut(true);
      const orderData = await paymentAPI.createOrder();

      const isRealRazorpayOrder = orderData.order_source === 'RAZORPAY_API' || (
        orderData.razorpay_order_id &&
        orderData.razorpay_order_id.startsWith('order_') &&
        !orderData.razorpay_order_id.startsWith('order_test_')
      );

      if (isRealRazorpayOrder) {
        const options = {
          key: orderData.key_id,
          amount: orderData.amount_paise,
          currency: orderData.currency,
          name: "ShopGenie",
          description: "ShopGenie Checkout (Razorpay Test Mode)",
          order_id: orderData.razorpay_order_id,
          prefill: {
            name: "Demo Customer",
            email: "demo@shopgenie.com",
            contact: "9999999999"
          },
          theme: {
            color: "#0F6B4C"
          },
          handler: async function (response) {
            try {
              const verifyRes = await paymentAPI.verify({
                order_id: orderData.order_id,
                razorpay_order_id: response.razorpay_order_id || orderData.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature
              });

              const freshCart = await cartAPI.get();
              updateCart(freshCart);
              const orders = await paymentAPI.getOrders();
              setOrderAuditTrail(orders);

              setOrderModal({
                status: 'paid',
                order_id: verifyRes.order_id,
                razorpay_order_id: verifyRes.razorpay_order_id,
                razorpay_payment_id: verifyRes.razorpay_payment_id,
                amount: verifyRes.amount,
                timestamp: verifyRes.timestamp
              });
            } catch (err) {
              console.error("Verification failed:", err);
              alert("Payment verification failed: " + (err.response?.data?.detail || err.message));
            }
          },
          modal: {
            ondismiss: async function () {
              await paymentAPI.cancel({ order_id: orderData.order_id });
              const orders = await paymentAPI.getOrders();
              setOrderAuditTrail(orders);
              setOrderModal({
                status: 'cancelled',
                order_id: orderData.order_id,
                amount: orderData.amount,
                timestamp: new Date().toLocaleString()
              });
            }
          }
        };

        const rzp = new window.Razorpay(options);
        rzp.on('payment.failed', async function (response) {
          const rzpErr = response.error || {};
          const fullErrDetails = {
            code: rzpErr.code || 'N/A',
            description: rzpErr.description || 'N/A',
            reason: rzpErr.reason || 'N/A',
            source: rzpErr.source || 'N/A',
            step: rzpErr.step || 'N/A',
            metadata: rzpErr.metadata || {}
          };
          console.error("Razorpay Payment Failed Detailed Log:", fullErrDetails);

          const formattedReason = `[Code: ${fullErrDetails.code}] ${fullErrDetails.description} (Reason: ${fullErrDetails.reason}, Step: ${fullErrDetails.step})`;

          await paymentAPI.fail({
            order_id: orderData.order_id,
            reason: formattedReason
          });
          const orders = await paymentAPI.getOrders();
          setOrderAuditTrail(orders);
          setOrderModal({
            status: 'failed',
            order_id: orderData.order_id,
            amount: orderData.amount,
            failure_reason: formattedReason,
            timestamp: new Date().toLocaleString()
          });
        });
        rzp.open();
      } else {
        // Backend did not return a genuine Razorpay TEST MODE order.
        // We never fabricate a payment here — surface it honestly instead.
        alert(
          "Checkout cannot proceed: the backend did not return a genuine Razorpay TEST MODE order " +
          "(order_source was not RAZORPAY_API). Check backend/.env RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET " +
          "and the backend server logs for details."
        );
      }
    } catch (err) {
      console.error("Checkout creation error:", err);
      alert("Could not create Razorpay order: " + (err.response?.data?.detail || err.message));
    } finally {
      setCheckingOut(false);
    }
  };

  const hasItems = cart && cart.items && cart.items.length > 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10 animate-fade-in">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <h2 className="font-display font-semibold text-3xl text-ink">Your Cart</h2>
          <span className="px-2.5 py-0.5 rounded-full bg-forest-50 text-[10px] font-semibold text-forest-600 uppercase tracking-wide flex items-center gap-1">
            <Lock className="h-3 w-3" />
            <span>Razorpay Test Checkout</span>
          </span>
        </div>
        <p className="text-inkMuted text-sm">Review your items and complete checkout with Razorpay Test Mode.</p>
      </div>

      {!hasItems ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          <div className="lg:col-span-2 card p-12 text-center space-y-5">
            <ShoppingCart className="h-14 w-14 text-sandDark mx-auto" />
            <h3 className="font-display font-semibold text-lg text-ink">Your cart is empty</h3>
            <p className="text-inkMuted text-sm max-w-sm mx-auto">
              Add products from the catalog or ask the AI Assistant directly to start building your order.
            </p>
            <button
              onClick={() => setCurrentPage('products')}
              className="inline-flex items-center gap-2 px-5 py-3 bg-forest-500 hover:bg-forest-600 text-white text-xs font-medium rounded-lg transition-colors"
            >
              <span>Browse Catalog</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="card p-6 space-y-4">
            <h4 className="font-display font-semibold text-ink text-sm flex items-center gap-2">
              <Bot className="h-5 w-5 text-forest-500" />
              <span>Genie Suggestions</span>
            </h4>
            <div className="p-4 rounded-xl bg-forest-50/60 text-xs text-inkMuted leading-relaxed">
              {cart.ai_suggestion || "Ask ShopGenie to recommend products matching your budget!"}
            </div>
            <button
              onClick={() => {
                setAgentPrompt("Recommend popular gadgets under ₹3,000");
                setCurrentPage('agent');
              }}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-forest-500 hover:bg-forest-600 text-white text-xs font-medium rounded-lg transition-colors"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Ask Genie to Recommend</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Cart items list */}
          <div className="lg:col-span-2 space-y-4">
            <div className="card overflow-hidden divide-y divide-sand">
              {cart.items.map((item) => (
                <div key={item.product_id} className="p-5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 min-w-0">
                    <ProductImage src={item.image_url} alt={item.name} className="w-16 h-16 rounded-lg object-cover bg-paperDim flex-shrink-0" />
                    <div className="space-y-1 min-w-0">
                      <h4 className="font-medium text-ink text-sm leading-tight max-w-[200px] sm:max-w-xs truncate">
                        {item.name}
                      </h4>
                      <p className="text-inkMuted text-xs">₹{item.price.toLocaleString()} each</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-5">
                    <div className="flex items-center gap-1.5 bg-paperDim border border-sand rounded-lg p-1">
                      <button
                        onClick={() => handleUpdateQuantity(item.product_id, item.quantity, -1)}
                        disabled={loadingId === item.product_id || item.quantity <= 1}
                        className="p-1 hover:bg-white text-inkMuted hover:text-ink rounded-md disabled:opacity-30 transition-colors"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="text-xs text-ink font-semibold px-2">{item.quantity}</span>
                      <button
                        onClick={() => handleUpdateQuantity(item.product_id, item.quantity, 1)}
                        disabled={loadingId === item.product_id}
                        className="p-1 hover:bg-white text-inkMuted hover:text-ink rounded-md transition-colors"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-ink font-semibold text-sm w-20 text-right">
                        ₹{item.item_total.toLocaleString()}
                      </span>
                      <button
                        onClick={() => handleRemoveItem(item.product_id)}
                        disabled={loadingId === item.product_id}
                        className="p-2 rounded-lg text-inkMuted hover:text-ember-600 hover:bg-ember-50 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end">
              <button onClick={handleClearCart} className="text-xs text-inkMuted hover:text-ember-600 flex items-center gap-1">
                <Trash2 className="h-3.5 w-3.5" />
                <span>Empty Cart</span>
              </button>
            </div>
          </div>

          {/* Right column summary + Razorpay checkout */}
          <div className="space-y-5">
            <div className="card p-6 space-y-4">
              <h4 className="font-display font-semibold text-ink text-sm flex items-center justify-between">
                <span>Order Summary</span>
                <span className="text-[10px] text-forest-600 font-medium">Razorpay Verified</span>
              </h4>
              <div className="space-y-2.5 text-xs pt-1">
                <div className="flex justify-between text-inkMuted">
                  <span>Subtotal</span>
                  <span className="text-ink">₹{cart.subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-inkMuted">
                  <span>Estimated Delivery</span>
                  {cart.delivery_fee === 0 ? (
                    <span className="text-forest-600 font-medium">FREE</span>
                  ) : (
                    <span className="text-ink">₹{cart.delivery_fee.toLocaleString()}</span>
                  )}
                </div>
                {cart.delivery_fee > 0 && (
                  <p className="text-[10px] text-inkMuted leading-normal">
                    Tip: Add ₹{(1000 - cart.subtotal).toLocaleString()} more to unlock FREE delivery!
                  </p>
                )}
                <div className="tear-divider pt-3 flex justify-between font-semibold text-sm text-ink">
                  <span>Total</span>
                  <span className="text-forest-600 font-semibold text-lg">₹{cart.total.toLocaleString()}</span>
                </div>
              </div>

              <button
                onClick={handleCheckout}
                disabled={checkingOut}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-forest-500 hover:bg-forest-600 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
              >
                {checkingOut ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                <span>{checkingOut ? 'Initiating Order...' : 'Pay with Razorpay Test Mode'}</span>
              </button>

              <div className="flex items-center justify-center gap-1.5 text-[10px] text-inkMuted pt-1">
                <ShieldCheck className="h-3.5 w-3.5 text-forest-500" />
                <span>HMAC SHA256 backend signature verification</span>
              </div>
            </div>

            <div className="card p-6 space-y-4">
              <h4 className="font-display font-semibold text-ink text-sm flex items-center gap-2">
                <Bot className="h-5 w-5 text-forest-500" />
                <span>Genie Suggestions</span>
              </h4>
              <div className="p-4 rounded-xl bg-forest-50/60 text-xs text-inkMuted leading-relaxed">
                {cart.ai_suggestion}
              </div>
              <button
                onClick={handleSuggestionAction}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-forest-500 hover:bg-forest-600 text-white text-xs font-medium rounded-lg transition-colors"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Let Genie Find It</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment & Order Audit Trail Section */}
      <div className="space-y-4 pt-6 tear-divider">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-semibold text-xl text-ink flex items-center gap-2">
            <History className="h-5 w-5 text-forest-500" />
            <span>Order History &amp; Payment Audit Trail</span>
          </h3>
        </div>

        {loadingHistory ? (
          <div className="card p-8 text-center">
            <RefreshCw className="h-5 w-5 animate-spin text-forest-500 mx-auto" />
          </div>
        ) : orderAuditTrail.length === 0 ? (
          <div className="card p-8 text-center text-xs text-inkMuted">
            No payments recorded yet. Complete a checkout to view live Razorpay transaction logs.
          </div>
        ) : (
          <div className="card overflow-hidden text-xs">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-sand">
                <thead className="bg-paperDim">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-inkMuted">Order ID</th>
                    <th className="px-4 py-3 text-left font-semibold text-inkMuted">Razorpay Order ID</th>
                    <th className="px-4 py-3 text-left font-semibold text-inkMuted">Razorpay Payment ID</th>
                    <th className="px-4 py-3 text-left font-semibold text-inkMuted">Amount</th>
                    <th className="px-4 py-3 text-left font-semibold text-inkMuted">Status</th>
                    <th className="px-4 py-3 text-left font-semibold text-inkMuted">Date &amp; Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sand bg-white">
                  {orderAuditTrail.map((ord) => {
                    const isPaid = ord.status === 'paid';
                    const isCancelled = ord.status === 'cancelled';
                    return (
                      <tr key={ord.order_id} className="hover:bg-paperDim/40">
                        <td className="px-4 py-3 font-semibold text-ink">#SG-ORD-{ord.order_id}</td>
                        <td className="px-4 py-3 text-inkMuted text-[11px]">{ord.razorpay_order_id}</td>
                        <td className="px-4 py-3 text-inkMuted text-[11px]">{ord.razorpay_payment_id}</td>
                        <td className="px-4 py-3 font-semibold text-ink">₹{ord.amount.toLocaleString()}</td>
                        <td className="px-4 py-3">
                          {isPaid ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-forest-50 text-forest-600 font-semibold text-[10px]">
                              <CheckCircle2 className="h-3 w-3" />
                              <span>PAID</span>
                            </span>
                          ) : isCancelled ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-ember-50 text-ember-600 font-semibold text-[10px]">
                              <AlertTriangle className="h-3 w-3" />
                              <span>CANCELLED</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-red-50 text-red-600 font-semibold text-[10px]">
                              <XCircle className="h-3 w-3" />
                              <span>FAILED</span>
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-inkMuted">{ord.timestamp}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Order Status Confirmation Modal */}
      {orderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white w-full max-w-lg p-6 rounded-2xl space-y-6 relative shadow-xl">
            <button
              onClick={() => setOrderModal(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-paperDim text-inkMuted hover:text-ink transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="text-center space-y-2">
              {orderModal.status === 'paid' ? (
                <div className="p-3 bg-forest-50 text-forest-600 rounded-full w-14 h-14 mx-auto flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
              ) : orderModal.status === 'cancelled' ? (
                <div className="p-3 bg-ember-50 text-ember-600 rounded-full w-14 h-14 mx-auto flex items-center justify-center">
                  <AlertTriangle className="h-8 w-8" />
                </div>
              ) : (
                <div className="p-3 bg-red-50 text-red-600 rounded-full w-14 h-14 mx-auto flex items-center justify-center">
                  <XCircle className="h-8 w-8" />
                </div>
              )}

              <h3 className="font-display font-semibold text-xl text-ink">
                {orderModal.status === 'paid'
                  ? 'Payment Verified & Order Confirmed!'
                  : orderModal.status === 'cancelled'
                    ? 'Checkout Cancelled'
                    : 'Payment Failed'}
              </h3>
              <p className="text-xs text-inkMuted">
                {orderModal.status === 'paid'
                  ? 'Your payment was processed and verified using Razorpay HMAC SHA256.'
                  : orderModal.status === 'cancelled'
                    ? 'The payment modal was closed before completing checkout.'
                    : orderModal.failure_reason || 'The transaction could not be completed.'}
              </p>
            </div>

            <div className="bg-paperDim/60 rounded-xl p-4 space-y-3 text-xs">
              <div className="flex justify-between tear-divider pb-2">
                <span className="text-inkMuted">Order ID</span>
                <span className="text-ink font-semibold">#SG-ORD-{orderModal.order_id}</span>
              </div>

              {orderModal.razorpay_order_id && (
                <div className="flex justify-between tear-divider pb-2">
                  <span className="text-inkMuted">Razorpay Order ID</span>
                  <span className="text-ink text-[11px]">{orderModal.razorpay_order_id}</span>
                </div>
              )}

              {orderModal.razorpay_payment_id && (
                <div className="flex justify-between tear-divider pb-2">
                  <span className="text-inkMuted">Razorpay Payment ID</span>
                  <span className="text-ink text-[11px]">{orderModal.razorpay_payment_id}</span>
                </div>
              )}

              <div className="flex justify-between tear-divider pb-2">
                <span className="text-inkMuted">Amount</span>
                <span className="text-forest-600 font-semibold">₹{orderModal.amount.toLocaleString()}</span>
              </div>

              <div className="flex justify-between tear-divider pb-2">
                <span className="text-inkMuted">Payment Status</span>
                <span className={`font-semibold uppercase tracking-wide ${
                  orderModal.status === 'paid' ? 'text-forest-600' : orderModal.status === 'cancelled' ? 'text-ember-600' : 'text-red-600'
                }`}>
                  {orderModal.status}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-inkMuted">Timestamp</span>
                <span className="text-inkMuted">{orderModal.timestamp}</span>
              </div>
            </div>

            <button
              onClick={() => setOrderModal(null)}
              className="w-full py-3 bg-forest-500 hover:bg-forest-600 text-white text-xs font-medium rounded-lg transition-colors"
            >
              Close Window
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
