import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useUpdatePolitician, type PoliticianEditData } from '../../hooks/usePoliticians';
import type { Politician } from '../../types';

interface Props {
  politician: Politician;
  open: boolean;
  onClose: () => void;
}

export function EditPoliticianModal({ politician, open, onClose }: Props) {
  const name = politician.person?.name ?? '';

  const [form, setForm] = useState<PoliticianEditData>({
    name,
    political_position: politician.political_position ?? '',
    political_party: politician.political_party ?? '',
    tenure_start: politician.tenure_start?.slice(0, 4) ?? '',
    tenure_end: politician.tenure_end?.slice(0, 4) ?? '',
    photo_url: politician.photo_url ?? '',
    photo_source_url: politician.photo_source_url ?? '',
    photo_source_name: politician.photo_source_name ?? '',
  });

  const { mutate, isPending, error } = useUpdatePolitician();

  const handleChange = (field: keyof PoliticianEditData) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutate({ politician, data: form }, { onSuccess: onClose });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-dark-800 border-dark-700 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white text-base">Editar político</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label className="text-gray-400 text-xs">Nombre completo</Label>
            <Input
              value={form.name}
              onChange={handleChange('name')}
              className="bg-dark-700 border-dark-600 text-white text-sm"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-gray-400 text-xs">Cargo político</Label>
            <Input
              value={form.political_position}
              onChange={handleChange('political_position')}
              className="bg-dark-700 border-dark-600 text-white text-sm"
              placeholder="Ej. Ministro de Obras Públicas"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-gray-400 text-xs">Partido político</Label>
            <Input
              value={form.political_party}
              onChange={handleChange('political_party')}
              className="bg-dark-700 border-dark-600 text-white text-sm"
              placeholder="Ej. Partido Panameñista"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-gray-400 text-xs">Año inicio</Label>
              <Input
                value={form.tenure_start}
                onChange={handleChange('tenure_start')}
                className="bg-dark-700 border-dark-600 text-white text-sm"
                placeholder="YYYY"
                maxLength={4}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-gray-400 text-xs">Año fin</Label>
              <Input
                value={form.tenure_end}
                onChange={handleChange('tenure_end')}
                className="bg-dark-700 border-dark-600 text-white text-sm"
                placeholder="YYYY"
                maxLength={4}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-gray-400 text-xs">URL de foto</Label>
            <Input
              value={form.photo_url}
              onChange={handleChange('photo_url')}
              className="bg-dark-700 border-dark-600 text-white text-sm"
              placeholder="https://..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-gray-400 text-xs">URL fuente foto</Label>
              <Input
                value={form.photo_source_url}
                onChange={handleChange('photo_source_url')}
                className="bg-dark-700 border-dark-600 text-white text-sm"
                placeholder="https://..."
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-gray-400 text-xs">Nombre fuente foto</Label>
              <Input
                value={form.photo_source_name}
                onChange={handleChange('photo_source_name')}
                className="bg-dark-700 border-dark-600 text-white text-sm"
                placeholder="Ej. Wikipedia"
              />
            </div>
          </div>

          {error && (
            <p className="text-red-400 text-xs">{(error as Error).message}</p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-gray-400 hover:text-white"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
              Guardar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
