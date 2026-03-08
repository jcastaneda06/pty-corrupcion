import { Bell, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNotifications, useMarkRead, useMarkAllRead, useClearNotification, useClearAllNotifications } from '../../hooks/useNotifications';
import { useAuth } from '../../contexts/AuthContext';
import { formatRelativeTime } from '../../lib/utils';

export function NotificationBell() {
  const { user } = useAuth();
  const { notifications, unreadCount } = useNotifications();
  const { mutate: markRead } = useMarkRead();
  const { mutate: markAllRead } = useMarkAllRead();
  const { mutate: clearOne } = useClearNotification();
  const { mutate: clearAll } = useClearAllNotifications();

  if (!user) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="relative w-8 h-8 rounded-full bg-dark-700 border border-dark-600 flex items-center justify-center text-gray-400 hover:text-white hover:bg-dark-600 transition-colors"
          aria-label="Notificaciones"
        >
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 bg-red-500 rounded-full flex items-center justify-center text-[10px] font-bold text-white leading-none">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 bg-dark-800 border-dark-600">
        <div className="flex items-center justify-between px-4 py-3 border-b border-dark-600">
          <span className="text-sm font-semibold text-white">Notificaciones</span>
          {notifications.length > 0 && (
            <div className="flex items-center gap-3">
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllRead()}
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  Marcar todo leído
                </button>
              )}
              <button
                onClick={() => clearAll()}
                className="text-xs text-gray-400 hover:text-red-400 transition-colors"
              >
                Limpiar todo
              </button>
            </div>
          )}
        </div>
        {notifications.length === 0 ? (
          <div className="py-10 text-center text-sm text-gray-500">
            Sin notificaciones
          </div>
        ) : (
          <ScrollArea className="max-h-96">
            <div className="divide-y divide-dark-700">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className={`relative w-full text-left px-4 py-3 hover:bg-dark-700 transition-colors cursor-pointer ${
                    !n.is_read ? 'bg-dark-700/50' : ''
                  }`}
                  onClick={() => { if (!n.is_read) markRead(n.id); }}
                >
                  <button
                    onClick={(e) => { e.stopPropagation(); clearOne(n.id); }}
                    className="absolute top-2 right-2 p-0.5 text-gray-600 hover:text-gray-300 transition-colors"
                    aria-label="Eliminar notificación"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                  <div className="flex items-start gap-2 pr-5">
                    {!n.is_read && (
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                    )}
                    <div className={!n.is_read ? '' : 'pl-3.5'}>
                      <p className="text-sm font-medium text-white leading-snug">{n.title}</p>
                      <p className="text-sm text-gray-400 mt-0.5 leading-snug">{n.body}</p>
                      <p className="text-xs text-gray-500 mt-1">{formatRelativeTime(n.created_at)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </PopoverContent>
    </Popover>
  );
}
