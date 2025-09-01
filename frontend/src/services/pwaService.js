class PWAService {
  constructor() {
    this.isSupported = 'serviceWorker' in navigator;
    this.registration = null;
    this.updateAvailable = false;
    this.updateCallback = null;
  }

  // Register service worker
  async register() {
    if (!this.isSupported) {
      console.log('Service Worker not supported');
      return false;
    }

    try {
      this.registration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker registered successfully:', this.registration);

      // Handle updates
      this.handleUpdates();
      
      // Handle offline/online events
      this.handleConnectivityEvents();
      
      // Request notification permission
      this.requestNotificationPermission();

      return true;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      return false;
    }
  }

  // Handle service worker updates
  handleUpdates() {
    if (!this.registration) return;

    // Check for updates
    this.registration.addEventListener('updatefound', () => {
      const newWorker = this.registration.installing;
      
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          this.updateAvailable = true;
          this.notifyUpdateAvailable();
        }
      });
    });

    // Handle controller change
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('New service worker activated');
      this.updateAvailable = false;
      
      if (this.updateCallback) {
        this.updateCallback();
        this.updateCallback = null;
      }
    });
  }

  // Notify that an update is available
  notifyUpdateAvailable() {
    // You can customize this notification
    if ('serviceWorker' in navigator && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification('Blog App Update Available', {
          body: 'A new version is available. Click to update.',
          icon: '/favicon.ico',
          tag: 'update-available'
        });
      }
    }

    // Emit custom event
    window.dispatchEvent(new CustomEvent('pwa-update-available'));
  }

  // Handle connectivity events
  handleConnectivityEvents() {
    window.addEventListener('online', () => {
      console.log('App is online');
      this.syncOfflineData();
      window.dispatchEvent(new CustomEvent('pwa-online'));
    });

    window.addEventListener('offline', () => {
      console.log('App is offline');
      window.dispatchEvent(new CustomEvent('pwa-offline'));
    });
  }

  // Sync offline data when coming back online
  async syncOfflineData() {
    try {
      // Trigger background sync
      if (this.registration && 'sync' in this.registration) {
        await this.registration.sync.register('background-sync');
        console.log('Background sync registered');
      }

      // Sync any pending offline actions
      await this.syncPendingActions();
    } catch (error) {
      console.error('Failed to sync offline data:', error);
    }
  }

  // Sync pending offline actions
  async syncPendingActions() {
    try {
      // Get pending actions from IndexedDB or localStorage
      const pendingActions = this.getPendingActions();
      
      for (const action of pendingActions) {
        try {
          await this.processOfflineAction(action);
          this.removePendingAction(action.id);
        } catch (error) {
          console.error('Failed to process offline action:', error);
        }
      }
    } catch (error) {
      console.error('Failed to sync pending actions:', error);
    }
  }

  // Get pending actions from storage
  getPendingActions() {
    try {
      const actions = localStorage.getItem('pwa-pending-actions');
      return actions ? JSON.parse(actions) : [];
    } catch (error) {
      console.error('Failed to get pending actions:', error);
      return [];
    }
  }

  // Add pending action to storage
  addPendingAction(action) {
    try {
      const actions = this.getPendingActions();
      actions.push({
        id: Date.now().toString(),
        timestamp: Date.now(),
        ...action
      });
      localStorage.setItem('pwa-pending-actions', JSON.stringify(actions));
    } catch (error) {
      console.error('Failed to add pending action:', error);
    }
  }

  // Remove pending action from storage
  removePendingAction(actionId) {
    try {
      const actions = this.getPendingActions();
      const filteredActions = actions.filter(action => action.id !== actionId);
      localStorage.setItem('pwa-pending-actions', JSON.stringify(filteredActions));
    } catch (error) {
      console.error('Failed to remove pending action:', error);
    }
  }

  // Process offline action
  async processOfflineAction(action) {
    try {
      switch (action.type) {
        case 'create_blog':
          return await this.processCreateBlog(action.data);
        case 'create_comment':
          return await this.processCreateComment(action.data);
        case 'like_blog':
          return await this.processLikeBlog(action.data);
        case 'update_profile':
          return await this.processUpdateProfile(action.data);
        default:
          console.log('Unknown action type:', action.type);
      }
    } catch (error) {
      console.error('Failed to process offline action:', error);
      throw error;
    }
  }

  // Process create blog action
  async processCreateBlog(data) {
    // This would make the actual API call
    const response = await fetch('/api/blogs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return response.json();
  }

  // Process create comment action
  async processCreateComment(data) {
    const response = await fetch(`/api/blog/${data.blogId}/comment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return response.json();
  }

  // Process like blog action
  async processLikeBlog(data) {
    const response = await fetch(`/api/blog/${data.blogId}/like`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return response.json();
  }

  // Process update profile action
  async processUpdateProfile(data) {
    const response = await fetch(`/api/user/profile/${data.userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return response.json();
  }

  // Request notification permission
  async requestNotificationPermission() {
    if (!('Notification' in window)) {
      console.log('Notifications not supported');
      return false;
    }

    if (Notification.permission === 'default') {
      try {
        const permission = await Notification.requestPermission();
        return permission === 'granted';
      } catch (error) {
        console.error('Failed to request notification permission:', error);
        return false;
      }
    }

    return Notification.permission === 'granted';
  }

  // Show notification
  showNotification(title, options = {}) {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      return false;
    }

    try {
      const notification = new Notification(title, {
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        ...options
      });

      // Auto-close after 5 seconds
      setTimeout(() => {
        notification.close();
      }, 5000);

      return notification;
    } catch (error) {
      console.error('Failed to show notification:', error);
      return false;
    }
  }

  // Check if app is installed
  isInstalled() {
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.navigator.standalone === true;
  }

  // Check if app is online
  isOnline() {
    return navigator.onLine;
  }

  // Get app status
  getStatus() {
    return {
      isSupported: this.isSupported,
      isRegistered: !!this.registration,
      isInstalled: this.isInstalled(),
      isOnline: this.isOnline(),
      updateAvailable: this.updateAvailable,
      notificationPermission: 'Notification' in window ? Notification.permission : 'not-supported'
    };
  }

  // Update the app
  async update() {
    if (!this.registration || !this.updateAvailable) {
      return false;
    }

    try {
      // Send message to service worker to skip waiting
      if (this.registration.waiting) {
        this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to update app:', error);
      return false;
    }
  }

  // Set update callback
  onUpdateAvailable(callback) {
    this.updateCallback = callback;
  }

  // Cache URLs
  async cacheUrls(urls) {
    if (!this.registration) return false;

    try {
      const cache = await caches.open('dynamic-v1');
      await cache.addAll(urls);
      return true;
    } catch (error) {
      console.error('Failed to cache URLs:', error);
      return false;
    }
  }

  // Clear all caches
  async clearCaches() {
    if (!this.registration) return false;

    try {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map(cacheName => caches.delete(cacheName))
      );
      return true;
    } catch (error) {
      console.error('Failed to clear caches:', error);
      return false;
    }
  }

  // Unregister service worker
  async unregister() {
    if (!this.registration) return false;

    try {
      await this.registration.unregister();
      this.registration = null;
      return true;
    } catch (error) {
      console.error('Failed to unregister service worker:', error);
      return false;
    }
  }
}

// Create singleton instance
const pwaService = new PWAService();

export default pwaService;
