import { useEffect, useCallback } from 'react';
import { useSyncStore, createSyncEvent } from '../../store/useSyncStore';
import { useWardrobeStore } from '../../store/useWardrobeStore';
import { useEcommerceStore } from '../../store/useEcommerceStore';
import type { SyncEvent, ClothingItem, Product } from '../../types';
import { RefreshCw, Wifi, WifiOff, AlertTriangle } from 'lucide-react';

interface DataSyncProps {
  showStatus?: boolean;
}

export const DataSync = ({ showStatus = true }: DataSyncProps) => {
  const {
    init,
    addSyncListener,
    removeSyncListener,
    isOnline,
    isSyncing,
    syncError,
    pendingSyncs,
    triggerFullSync,
    syncFromFittingToEcommerce,
    setOnlineStatus,
  } = useSyncStore();

  const { items: wardrobeItems } = useWardrobeStore();
  const { products } = useEcommerceStore();

  const handleFittingEvents = useCallback(
    (events: SyncEvent[]) => {
      events.forEach((event) => {
        switch (event.type) {
          case 'item_added':
            console.log('📥 同步: 衣橱添加新物品 -> 电商系统', event.payload);
            break;
          case 'item_removed':
            console.log('📤 同步: 衣橱移除物品 -> 电商系统', event.payload);
            break;
          case 'item_updated':
            console.log('🔄 同步: 衣橱更新物品 -> 电商系统', event.payload);
            break;
          case 'preset_saved': {
            console.log('💾 同步: 保存穿搭预设 -> 电商系统', event.payload);
            const itemIds = (
              event.payload.outfit as {
                items: Array<{ clothingItem: ClothingItem }>;
              }
            )?.items.map((i) => i.clothingItem.id);
            if (itemIds) {
              console.log('🔗 相关商品ID:', itemIds);
            }
            break;
          }
        }
      });
    },
    [],
  );

  const handleEcommerceEvents = useCallback(
    (events: SyncEvent[]) => {
      events.forEach((event) => {
        switch (event.type) {
          case 'cart_updated':
            console.log('🛒 同步: 购物车更新 -> 试衣模块', event.payload);
            if (
              !(event.payload.removed as boolean) &&
              (event.payload.quantity as number) > 0
            ) {
              const product = event.payload.product as Product;
              if (product) {
                console.log('👔 可添加到衣橱的商品:', product.name);
              }
            }
            break;
        }
      });
    },
    [],
  );

  useEffect(() => {
    init();

    const handleOnline = () => {
      setOnlineStatus(true);
      triggerFullSync();
    };
    const handleOffline = () => setOnlineStatus(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [init, setOnlineStatus, triggerFullSync]);

  useEffect(() => {
    addSyncListener('fitting-listener', handleFittingEvents);
    addSyncListener('ecommerce-listener', handleEcommerceEvents);

    return () => {
      removeSyncListener('fitting-listener');
      removeSyncListener('ecommerce-listener');
    };
  }, [
    addSyncListener,
    removeSyncListener,
    handleFittingEvents,
    handleEcommerceEvents,
  ]);

  useEffect(() => {
    if (wardrobeItems.length > 0 && products.length > 0) {
      const syncEvent = createSyncEvent(
        'item_updated',
        { count: wardrobeItems.length, syncType: 'wardrobe_to_ecommerce' },
        'fitting',
      );
      syncFromFittingToEcommerce(syncEvent);
    }
  }, [wardrobeItems.length, products.length, syncFromFittingToEcommerce]);

  if (!showStatus) return null;

  return (
    <div className="data-sync-status">
      <div className="data-sync-status__indicators">
        <div
          className={`data-sync-status__indicator ${
            isOnline
              ? 'data-sync-status__indicator--online'
              : 'data-sync-status__indicator--offline'
          }`}
          title={isOnline ? '在线' : '离线'}
        >
          {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
        </div>
        {isSyncing && (
          <div
            className="data-sync-status__indicator data-sync-status__indicator--syncing"
            title="同步中..."
          >
            <RefreshCw size={14} className="data-sync-status__spinner" />
          </div>
        )}
        {syncError && (
          <div
            className="data-sync-status__indicator data-sync-status__indicator--error"
            title={syncError}
          >
            <AlertTriangle size={14} />
          </div>
        )}
      </div>
      {pendingSyncs.length > 0 && (
        <div className="data-sync-status__pending">
          <span className="data-sync-status__pending-count">
            {pendingSyncs.length}
          </span>
          <span className="data-sync-status__pending-label">待同步</span>
        </div>
      )}
      {isOnline && pendingSyncs.length === 0 && !isSyncing && (
        <span className="data-sync-status__label">已同步</span>
      )}
    </div>
  );
};
