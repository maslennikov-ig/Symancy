import React from 'react';
import { TARIFFS, ProductType } from '../../types/payment';
import { TariffCard } from './TariffCard';
import { LoaderIcon } from '../LoaderIcon';

interface TariffSelectorProps {
  onClose: () => void;
  onSelectTariff: (productType: ProductType) => void;
  isLoading?: boolean;
}

const TariffSelector: React.FC<TariffSelectorProps> = ({
  onClose,
  onSelectTariff,
  isLoading = false,
}) => {
  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="tariff-selector-title"
    >
      <div
        className="bg-popover text-popover-foreground rounded-lg shadow-2xl p-6 sm:p-8 w-full max-w-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-muted-foreground hover:text-foreground p-2 rounded-full text-2xl leading-none"
          aria-label="Закрыть"
          disabled={isLoading}
        >
          &times;
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <h2
            id="tariff-selector-title"
            className="text-2xl font-display font-bold"
          >
            Выберите тариф
          </h2>
          <p className="text-muted-foreground mt-2 text-sm">
            Выберите подходящий пакет для анализа кофейной гущи
          </p>
        </div>

        {/* Tariff grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {TARIFFS.map((tariff) => (
            <TariffCard
              key={tariff.type}
              tariff={tariff}
              onSelect={() => onSelectTariff(tariff.type)}
              disabled={isLoading}
            />
          ))}
        </div>

        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-popover/80 backdrop-blur-sm rounded-lg flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <LoaderIcon className="h-8 w-8 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">
                Создание платежа...
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TariffSelector;
