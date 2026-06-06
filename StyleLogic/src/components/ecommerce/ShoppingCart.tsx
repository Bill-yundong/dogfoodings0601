import type { CartItem } from '../../types';
import { Minus, Plus, Trash2, ShoppingBag, X } from 'lucide-react';
import { useEcommerceStore } from '../../store/useEcommerceStore';

interface ShoppingCartProps {
  isOpen: boolean;
  onClose: () => void;
  onCheckout?: () => void;
}

export const ShoppingCart = ({ isOpen, onClose, onCheckout }: ShoppingCartProps) => {
  const { cart, updateCartItem, removeFromCart, calculateTotal, clearCart } =
    useEcommerceStore();

  if (!isOpen) return null;

  const handleUpdateQuantity = (productId: string, delta: number) => {
    const item = cart.find((c) => c.productId === productId);
    if (item) {
      const newQuantity = Math.max(0, item.quantity + delta);
      updateCartItem(productId, newQuantity);
    }
  };

  const total = calculateTotal();
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="shopping-cart-overlay" onClick={onClose}>
      <div
        className="shopping-cart"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shopping-cart__header">
          <h2>
            <ShoppingBag size={20} />
            购物车
            <span className="shopping-cart__count">({itemCount})</span>
          </h2>
          <button
            type="button"
            className="shopping-cart__close"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>

        {cart.length === 0 ? (
          <div className="shopping-cart__empty">
            <div className="shopping-cart__empty-icon">🛒</div>
            <p>购物车是空的</p>
            <p className="shopping-cart__empty-subtitle">去挑选心仪的商品吧</p>
          </div>
        ) : (
          <>
            <div className="shopping-cart__items">
              {cart.map((item) => (
                <CartItemComponent
                  key={item.productId}
                  item={item}
                  onUpdateQuantity={handleUpdateQuantity}
                  onRemove={removeFromCart}
                />
              ))}
            </div>

            <div className="shopping-cart__footer">
              <div className="shopping-cart__summary">
                <div className="shopping-cart__summary-row">
                  <span>商品总计</span>
                  <span>¥{total.toFixed(2)}</span>
                </div>
                <div className="shopping-cart__summary-row">
                  <span>运费</span>
                  <span className="shopping-cart__free-shipping">
                    {total >= 299 ? '免运费' : '¥12.00'}
                  </span>
                </div>
                <div className="shopping-cart__summary-row shopping-cart__summary-row--total">
                  <span>合计</span>
                  <span className="shopping-cart__total-price">
                    ¥{(total >= 299 ? total : total + 12).toFixed(2)}
                  </span>
                </div>
                {total < 299 && (
                  <div className="shopping-cart__free-shipping-tip">
                    再购买 ¥{(299 - total).toFixed(2)} 即可免运费
                  </div>
                )}
              </div>

              <div className="shopping-cart__actions">
                <button
                  type="button"
                  className="shopping-cart__btn shopping-cart__btn--secondary"
                  onClick={() => clearCart()}
                >
                  清空
                </button>
                <button
                  type="button"
                  className="shopping-cart__btn shopping-cart__btn--primary"
                  onClick={onCheckout}
                  disabled={cart.length === 0}
                >
                  去结算
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

interface CartItemComponentProps {
  item: CartItem;
  onUpdateQuantity: (productId: string, delta: number) => void;
  onRemove: (productId: string) => void;
}

const CartItemComponent = ({
  item,
  onUpdateQuantity,
  onRemove,
}: CartItemComponentProps) => {
  return (
    <div className="cart-item">
      <div className="cart-item__image-wrapper">
        {item.product.images && item.product.images[0] ? (
          <img
            src={item.product.images[0]}
            alt={item.product.name}
            className="cart-item__image"
          />
        ) : (
          <div className="cart-item__placeholder">👔</div>
        )}
      </div>
      <div className="cart-item__info">
        <div className="cart-item__brand">{item.product.brand}</div>
        <h4 className="cart-item__name">{item.product.name}</h4>
        <div className="cart-item__variants">
          <span
            className="cart-item__color"
            style={{ backgroundColor: item.selectedColor.hex }}
            title={item.selectedColor.name}
          />
          <span>{item.selectedMaterial.name}</span>
          <span>·</span>
          <span>{item.selectedSize}</span>
        </div>
        <div className="cart-item__price">¥{item.product.price}</div>
      </div>
      <div className="cart-item__actions">
        <div className="cart-item__quantity">
          <button
            type="button"
            className="cart-item__qty-btn"
            onClick={() => onUpdateQuantity(item.productId, -1)}
            disabled={item.quantity <= 1}
          >
            <Minus size={14} />
          </button>
          <span className="cart-item__qty-value">{item.quantity}</span>
          <button
            type="button"
            className="cart-item__qty-btn"
            onClick={() => onUpdateQuantity(item.productId, 1)}
          >
            <Plus size={14} />
          </button>
        </div>
        <div className="cart-item__subtotal">
          ¥{(item.product.price * item.quantity).toFixed(2)}
        </div>
        <button
          type="button"
          className="cart-item__remove-btn"
          onClick={() => onRemove(item.productId)}
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
};
