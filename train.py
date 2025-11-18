# train.py - Train a simple eye open/closed classifier (grayscale)
# NOTE: You need a dataset with this structure:
# dataset/
#   train/open
#   train/closed
#   val/open
#   val/closed

from tensorflow.keras.preprocessing.image import ImageDataGenerator
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import Conv2D, MaxPooling2D, Flatten, Dense, Dropout, BatchNormalization
from tensorflow.keras.optimizers import Adam
from tensorflow.keras.callbacks import ModelCheckpoint, ReduceLROnPlateau
import os

IMG_SIZE = (64, 64)
BATCH_SIZE = 32
EPOCHS = 20
TRAIN_DIR = "dataset/train"
VAL_DIR = "dataset/val"
OUTPUT_MODEL = "models/eye_classifier.h5"

os.makedirs(os.path.dirname(OUTPUT_MODEL), exist_ok=True)

train_gen = ImageDataGenerator(rescale=1./255,
                               rotation_range=10,
                               width_shift_range=0.1,
                               height_shift_range=0.1,
                               zoom_range=0.1,
                               horizontal_flip=True)
val_gen = ImageDataGenerator(rescale=1./255)

train_flow = train_gen.flow_from_directory(TRAIN_DIR,
                                           target_size=IMG_SIZE,
                                           batch_size=BATCH_SIZE,
                                           class_mode='binary',
                                           color_mode='grayscale')

val_flow = val_gen.flow_from_directory(VAL_DIR,
                                       target_size=IMG_SIZE,
                                       batch_size=BATCH_SIZE,
                                       class_mode='binary',
                                       color_mode='grayscale')

model = Sequential([
    Conv2D(32, (3,3), activation='relu', input_shape=(IMG_SIZE[0], IMG_SIZE[1], 1)),
    BatchNormalization(),
    MaxPooling2D(2,2),

    Conv2D(64, (3,3), activation='relu'),
    BatchNormalization(),
    MaxPooling2D(2,2),

    Conv2D(128, (3,3), activation='relu'),
    BatchNormalization(),
    MaxPooling2D(2,2),

    Flatten(),
    Dense(128, activation='relu'),
    Dropout(0.4),
    Dense(1, activation='sigmoid')
])

model.compile(optimizer=Adam(learning_rate=1e-4),
              loss='binary_crossentropy',
              metrics=['accuracy'])

callbacks = [
    ModelCheckpoint(OUTPUT_MODEL, monitor='val_accuracy', save_best_only=True, verbose=1),
    ReduceLROnPlateau(monitor='val_loss', factor=0.5, patience=3, verbose=1)
]

history = model.fit(train_flow,
                    epochs=EPOCHS,
                    validation_data=val_flow,
                    callbacks=callbacks)

print("Saved best model to:", OUTPUT_MODEL)
