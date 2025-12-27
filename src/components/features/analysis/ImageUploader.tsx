import React, { useCallback, useState, useRef } from 'react';
import { CardContent } from '../../ui/card';
import { UploadIcon } from '../../icons/UploadIcon';
import { cn } from '../../../lib/utils';

interface ImageUploaderProps {
  onImageSelect: (file: File) => void;
  t: (key: string) => string;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({ onImageSelect, t }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isValidDrop, setIsValidDrop] = useState(true);
  const dragCounter = useRef(0);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onImageSelect(file);
    }
  };

  const handleDragEnter = useCallback((event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragCounter.current++;
    if (event.dataTransfer.items && event.dataTransfer.items.length > 0) {
      const isImage = Array.from(event.dataTransfer.items).some((item: DataTransferItem) => item.kind === 'file' && item.type.startsWith('image/'));
      setIsValidDrop(isImage);
      setIsDragging(true);
    }
  }, []);
  
  const handleDragLeave = useCallback((event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
      setIsValidDrop(true);
    }
  }, []);

  const handleDrop = useCallback((event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;

    const file = event.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
        onImageSelect(file);
    } else {
        setIsValidDrop(true);
    }
  }, [onImageSelect]);

  const handleDragOver = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const uploaderClasses = cn(
    "w-full p-10 bg-muted/50 rounded-lg cursor-pointer transition-all duration-300 flex flex-col items-center justify-center border-2 border-dashed",
    {
      "border-border hover:border-primary/50 hover:bg-muted group": !isDragging,
      "border-primary bg-primary/10 ring-4 ring-primary/20": isDragging && isValidDrop,
      "border-destructive bg-destructive/10 ring-4 ring-destructive/20": isDragging && !isValidDrop,
    }
  );

  const iconClasses = cn(
    "w-12 h-12 text-muted-foreground mb-4 transition-all duration-300",
    {
      "group-hover:scale-105 group-hover:text-primary": !isDragging,
      "scale-110 text-primary": isDragging && isValidDrop,
      "scale-110 text-destructive": isDragging && !isValidDrop,
    }
  );
  
  const textClasses = cn(
    "text-lg font-semibold text-foreground",
    isDragging && !isValidDrop && "text-destructive"
  );


  return (
    <CardContent className="flex flex-col items-center justify-center p-4 text-center">
       <label
        htmlFor="image-upload"
        className={uploaderClasses}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
      >
        <input
          id="image-upload"
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
        <UploadIcon className={iconClasses} />
        <p className={textClasses}>
          {isDragging 
            ? (isValidDrop ? t('uploader.drop.validTitle') : t('uploader.drop.invalidTitle')) 
            : t('uploader.title')}
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          {isDragging 
            ? (isValidDrop ? t('uploader.drop.validSubtitle') : t('uploader.drop.invalidSubtitle')) 
            : t('uploader.subtitle')}
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