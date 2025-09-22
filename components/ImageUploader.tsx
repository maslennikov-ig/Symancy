import React, { useCallback } from 'react';
import { CardContent } from './ui/card';
import { UploadIcon } from './UploadIcon';

interface ImageUploaderProps {
  onImageSelect: (file: File) => void;
  t: (key: string) => string;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({ onImageSelect, t }) => {
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onImageSelect(file);
    }
  };

  const onDrop = useCallback((event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const file = event.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
        onImageSelect(file);
    }
  }, [onImageSelect]);

  const onDragOver = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };


  return (
    <CardContent className="flex flex-col items-center justify-center p-4 text-center">
       <label
        htmlFor="image-upload"
        className="w-full p-10 bg-muted/50 rounded-lg cursor-pointer transition-all duration-300 flex flex-col items-center justify-center border-2 border-dashed border-border hover:border-primary/50 hover:bg-muted group"
        onDrop={onDrop}
        onDragOver={onDragOver}
      >
        <input
          id="image-upload"
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
        <UploadIcon className="w-12 h-12 text-muted-foreground mb-4 transition-transform duration-300 group-hover:scale-105 group-hover:text-primary" />
        <p className="text-lg font-semibold text-foreground">
          {t('uploader.title')}
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          {t('uploader.subtitle')}
        </p>
      </label>
       <div className="mt-8 text-sm text-muted-foreground text-left space-y-3 w-full max-w-md">
        <p className="font-semibold text-foreground">{t('uploader.tip.title')}</p>
        <ul className="space-y-2">
            <li className="flex items-start"><span className="text-primary mr-2">✦</span>{t('uploader.tip.1')}</li>
            <li className="flex items-start"><span className="text-primary mr-2">✦</span>{t('uploader.tip.2')}</li>
            <li className="flex items-start"><span className="text-primary mr-2">✦</span>{t('uploader.tip.3')}</li>
        </ul>
       </div>
    </CardContent>
  );
};

export default ImageUploader;
