================================================================================
       X-RAY HEAD DATASET - ML CLASSIFICATION: FULL CHAT SUMMARY
================================================================================
Date: April 15, 2026
Topic: Preprocessing X-ray images of human heads for ML-based disease classification
         (including multi-label classification handling)
================================================================================


--------------------------------------------------------------------------------
QUESTION 1: How to preprocess the dataset properly?
--------------------------------------------------------------------------------

STEP 1: DATASET AUDIT (Before Any Processing)
----------------------------------------------
- Check class distribution (balanced vs skewed — rare diseases often have very
  few samples compared to normal cases)
- Check image formats (DICOM .dcm is standard for medical imaging; PNG/JPG also common)
- Spot corrupted/unreadable files early
- Check for duplicates (same patient scanned multiple times causes data leakage)


STEP 2: DICOM HANDLING (if applicable)
---------------------------------------
If data is in DICOM format, extract pixel array first:

    import pydicom
    import numpy as np

    dcm = pydicom.dcmread("scan.dcm")
    image = dcm.pixel_array.astype(np.float32)

    # Apply DICOM windowing (very important for X-rays)
    window_center = dcm.WindowCenter
    window_width = dcm.WindowWidth
    img_min = window_center - window_width // 2
    img_max = window_center + window_width // 2
    image = np.clip(image, img_min, img_max)


STEP 3: IMAGE STANDARDIZATION
-------------------------------
All images must be the same size and type:

    from PIL import Image

    def standardize(img_path, target_size=(224, 224)):
        img = Image.open(img_path).convert("L")  # Grayscale for X-rays
        img = img.resize(target_size, Image.LANCZOS)
        return np.array(img)

NOTE: 224x224 matches pretrained CNN input sizes (ResNet, EfficientNet, etc.)


STEP 4: NORMALIZATION
----------------------
    # Min-Max Normalization (most common for X-rays)
    image = (image - image.min()) / (image.max() - image.min())

    # OR Z-score (if using ImageNet-pretrained models)
    mean, std = 0.485, 0.229  # approximate for grayscale X-rays
    image = (image - mean) / std


STEP 5: HANDLING CLASS IMBALANCE
----------------------------------
Critical for rare diseases. Use a combination of:

A. Oversampling rare classes (SMOTE or duplication with augmentation):
    from imblearn.over_sampling import SMOTE

B. Class weights in the loss function (simpler & effective):
    from sklearn.utils.class_weight import compute_class_weight
    weights = compute_class_weight('balanced', classes=np.unique(y), y=y)


STEP 6: DATA AUGMENTATION
---------------------------
Especially important for rare disease classes:

    from torchvision import transforms

    train_transforms = transforms.Compose([
        transforms.RandomHorizontalFlip(),
        transforms.RandomRotation(10),
        transforms.RandomAffine(degrees=0, translate=(0.05, 0.05)),
        transforms.ColorJitter(brightness=0.2, contrast=0.2),
        transforms.ToTensor(),
    ])

AVOID extreme augmentations (vertical flip, large crops) — they can create
anatomically impossible images that confuse the model.


STEP 7: TRAIN / VAL / TEST SPLIT
----------------------------------
    from sklearn.model_selection import StratifiedShuffleSplit

    sss = StratifiedShuffleSplit(n_splits=1, test_size=0.2, random_state=42)
    # Stratified = preserves class proportions in each split

IMPORTANT: Split BEFORE augmentation. Augmented images should only exist in the
training set, never in val/test.


FINAL PREPROCESSING CHECKLIST:
--------------------------------
  [ ] Audit class distribution
  [ ] Handle DICOM windowing
  [ ] Resize to uniform dimensions
  [ ] Convert to grayscale (or 3-ch if using pretrained)
  [ ] Normalize pixel values
  [ ] Address class imbalance
  [ ] Apply augmentation (train only)
  [ ] Stratified train/val/test split
  [ ] Check for data leakage


KEY TOOLS:
-----------
  - pydicom          : DICOM reading
  - Pillow / OpenCV  : image manipulation
  - torchvision /
    albumentations   : augmentation (albumentations recommended for medical imaging)
  - scikit-learn     : splits, class weights
  - imbalanced-learn : SMOTE and oversampling


================================================================================
QUESTION 2: What else can be done to the images for a multi-label problem?
================================================================================


MULTI-LABEL SPECIFIC CHANGES
------------------------------
In multi-label classification, one X-ray can show MULTIPLE conditions at once.
Each sample gets a binary vector instead of a single class integer.

Label Encoding:
    # Example: 5 disease classes
    # [Normal, Fracture, Tumor, Hemorrhage, Calcification]
    label = [0, 1, 0, 1, 0]  # This scan has Fracture + Hemorrhage

    from sklearn.preprocessing import MultiLabelBinarizer
    mlb = MultiLabelBinarizer()
    y = mlb.fit_transform([["Fracture", "Hemorrhage"], ["Tumor"], ...])


ADVANCED IMAGE ENHANCEMENT TECHNIQUES
---------------------------------------

1. CLAHE (Contrast Limited Adaptive Histogram Equalization)
   ---------------------------------------------------------
   Most impactful enhancement for X-rays. Sharpens subtle features like
   hairline fractures or early-stage lesions:

       import cv2

       def apply_clahe(image):
           image_uint8 = (image * 255).astype(np.uint8)
           clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
           enhanced = clahe.apply(image_uint8)
           return enhanced / 255.0


2. Skull Stripping / ROI Masking
   --------------------------------
   Masks out skull boundary and background noise to focus the model on brain tissue:

       def mask_roi(image):
           _, binary = cv2.threshold(image, 0.1, 1.0, cv2.THRESH_BINARY)
           binary = (binary * 255).astype(np.uint8)
           contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL,
                                          cv2.CHAIN_APPROX_SIMPLE)
           mask = np.zeros_like(binary)
           cv2.drawContours(mask, [max(contours, key=cv2.contourArea)],
                            -1, 255, -1)
           return image * (mask / 255.0)


3. Multi-Scale / Pyramid Representation
   ----------------------------------------
   Diseases appear at different scales. Feeding multiple resolutions captures both
   large (tumors) and small (microhemorrhages) features:

       from PIL import Image

       def image_pyramid(img, scales=[224, 112, 56]):
           return [np.array(img.resize((s, s), Image.LANCZOS)) for s in scales]


4. Edge Detection as an Extra Channel
   -------------------------------------
   Highlights structural boundaries — useful for fractures and mass borders:

       def add_edge_channel(image):
           image_uint8 = (image * 255).astype(np.uint8)
           edges = cv2.Canny(image_uint8, threshold1=50, threshold2=150)
           return edges / 255.0

       # Stack: [original, edges] → 2-channel input
       stacked = np.stack([original, edge_channel], axis=0)


5. Convert to 3-Channel for Pretrained Models
   -----------------------------------------------
   Pretrained CNNs expect RGB (3 channels). Two options:

       # Option A: Simple repeat (most common)
       image_3ch = np.stack([image, image, image], axis=-1)

       # Option B: Meaningful channels (RECOMMENDED for medical imaging)
       image_3ch = np.stack([original, clahe_enhanced, edge_map], axis=-1)
       # This gives the model richer, non-redundant information


6. Denoising
   ------------
   X-rays often have acquisition noise:

       # Gaussian blur (mild, preserves structure)
       denoised = cv2.GaussianBlur(image, (3, 3), 0)

       # Non-local means (stronger, better quality)
       denoised = cv2.fastNlMeansDenoising(image_uint8, h=10)


7. Augmentation Additions for Multi-Label (using albumentations)
   ----------------------------------------------------------------
   albumentations transforms image and all labels together cleanly:

       import albumentations as A

       transform = A.Compose([
           A.GridDistortion(p=0.3),
           A.ElasticTransform(p=0.3),
           A.GaussianNoise(p=0.4),
           A.RandomGamma(p=0.3),
           A.CLAHE(p=0.5),
           A.ShiftScaleRotate(
               shift_limit=0.05,
               scale_limit=0.1,
               rotate_limit=10, p=0.5
           ),
       ])


REVISED 3-CHANNEL PIPELINE (Summary)
--------------------------------------
  Raw X-ray
      |
      |--- Denoise
      |--- CLAHE enhance        → Channel 1
      |--- Original normalized  → Channel 2
      └--- Edge map (Canny)     → Channel 3
               |
           Stack into [3 x 224 x 224]
               |
           Augmentation (albumentations)
               |
           Feed to EfficientNet / ResNet
               |
           Sigmoid output (one node per disease class)   ← NOT Softmax


LOSS FUNCTION FOR MULTI-LABEL (Non-negotiable change)
------------------------------------------------------
Do NOT use CrossEntropyLoss for multi-label. Use BCEWithLogitsLoss:

    import torch.nn as nn

    criterion = nn.BCEWithLogitsLoss()

    # For class imbalance (rare diseases), add pos_weight:
    pos_weight = torch.tensor([1.0, 5.0, 8.0, 3.0, 6.0])  # higher = rarer
    criterion = nn.BCEWithLogitsLoss(pos_weight=pos_weight)


EVALUATION METRICS FOR MULTI-LABEL
------------------------------------
Standard accuracy is meaningless for multi-label. Use:

  Metric              | Why
  --------------------|------------------------------------------------------
  mAP                 | Best overall metric for multi-label classification
  (mean Avg Precision)|
  --------------------|------------------------------------------------------
  F1 per class        | Catches poor performance on rare diseases
  --------------------|------------------------------------------------------
  Hamming Loss        | Fraction of wrong labels across all classes
  --------------------|------------------------------------------------------
  ROC-AUC per class   | Threshold-independent performance per disease


================================================================================
NEXT STEPS (Suggested)
================================================================================
  1. Build model architecture: EfficientNet / ResNet with multi-label head
  2. Training loop with BCEWithLogitsLoss + pos_weight
  3. Grad-CAM visualization for interpretability (important for medical imaging)
  4. Threshold tuning per class (0.5 default may not be optimal for rare diseases)

================================================================================
END OF DOCUMENT
================================================================================

