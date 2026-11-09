import { useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type ScrollViewInstance,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { SymbolView } from 'expo-symbols';

import {
  getMockPhotoQuestionAnswer,
  getMockPlantAnswer,
} from '@/data/mock-plants';
import { useCameraOverlay } from '@/components/camera-overlay-context';

type Message = {
  id: string;
  role: 'assistant' | 'user';
  text: string;
  source?: 'text' | 'camera' | 'upload';
  imageUri?: string;
};

const quickQuestions = [
  'Apa manfaat jahe?',
  'Cara memakai daun sirih?',
  'Apakah kunyit aman?',
];

const welcomeMessage: Message = {
  id: 'welcome',
  role: 'assistant',
  text: 'Halo! Aku Ramu, teman belajarmu tentang tanaman obat. Tanyakan tanaman yang ingin kamu kenali, atau kirim foto daunnya.',
};

const iconNames = {
  northeast: { ios: 'arrow.up.right', android: 'north_east', web: 'north_east' },
  camera: { ios: 'camera', android: 'photo_camera', web: 'photo_camera' },
  gallery: { ios: 'photo.on.rectangle', android: 'photo_library', web: 'photo_library' },
  send: { ios: 'arrow.up', android: 'arrow_upward', web: 'arrow_upward' },
} as const;

function ActionIcon({
  name,
  color,
  size = 20,
}: {
  name: keyof typeof iconNames;
  color: string;
  size?: number;
}) {
  return (
    <SymbolView
      name={iconNames[name]}
      tintColor={color}
      size={size}
      type="monochrome"
    />
  );
}

export default function HomeScreen() {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [isResponsiveLayoutReady, setIsResponsiveLayoutReady] = useState(
    Platform.OS !== 'web',
  );
  const isNarrow = isResponsiveLayoutReady && windowWidth < 360;
  const isCompact = isResponsiveLayoutReady && windowWidth < 390;
  const horizontalGutter = isResponsiveLayoutReady
    ? isCompact
      ? 14
      : windowWidth >= 768
        ? 28
        : 20
    : 20;
  const cameraFrameWidth = isResponsiveLayoutReady
    ? Math.max(130, Math.min(windowWidth * 0.72, (windowHeight - 300) * 0.78))
    : 250;
  const [messages, setMessages] = useState<Message[]>([welcomeMessage]);
  const [draft, setDraft] = useState('');
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [pendingImageSource, setPendingImageSource] = useState<
    'camera' | 'upload' | null
  >(null);
  const [isResponding, setIsResponding] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraAttempt, setCameraAttempt] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const scrollRef = useRef<ScrollViewInstance | null>(null);
  const cameraRef = useRef<CameraView>(null);
  const responseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keyboardScrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const { isCameraOpen, setIsCameraOpen } = useCameraOverlay();

  useEffect(() => {
    if (Platform.OS !== 'web') {
      return;
    }

    const frame = requestAnimationFrame(() => setIsResponsiveLayoutReady(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSubscription = Keyboard.addListener(showEvent, () => {
      setIsKeyboardVisible(true);
      if (keyboardScrollTimer.current) {
        clearTimeout(keyboardScrollTimer.current);
      }
      keyboardScrollTimer.current = setTimeout(
        () => scrollRef.current?.scrollToEnd({ animated: true }),
        120,
      );
    });
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setIsKeyboardVisible(false);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
      if (keyboardScrollTimer.current) {
        clearTimeout(keyboardScrollTimer.current);
      }
    };
  }, []);

  useEffect(
    () => () => {
      if (responseTimer.current) {
        clearTimeout(responseTimer.current);
      }
    },
    [],
  );

  const sendMessage = (
    text: string,
    source: Message['source'] = 'text',
    imageUri?: string,
  ) => {
    const trimmedText =
      text.trim() || (imageUri ? 'Apa yang bisa kamu jelaskan dari gambar ini?' : '');
    if ((!trimmedText && !imageUri) || isResponding) {
      return;
    }

    Keyboard.dismiss();
    setNotice(null);
    setDraft('');
    setPendingImage(null);
    setPendingImageSource(null);
    setMessages((current) => [
      ...current,
      {
        id: `user-${Date.now()}`,
        role: 'user',
        text: trimmedText,
        source,
        imageUri,
      },
    ]);
    setIsResponding(true);

    responseTimer.current = setTimeout(() => {
      const answer =
        source === 'camera' || source === 'upload'
          ? getMockPhotoQuestionAnswer(trimmedText)
          : getMockPlantAnswer(trimmedText);
      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          text: answer,
        },
      ]);
      setIsResponding(false);
    }, 550);
  };
  const submitDraft = () =>
    sendMessage(
      draft,
      pendingImageSource ?? 'text',
      pendingImage ?? undefined,
    );

  const openCamera = async () => {
    try {
      if (Platform.OS === 'web') {
        if (!window.isSecureContext) {
          setNotice('Kamera web hanya bisa digunakan melalui HTTPS atau localhost. Buka aplikasi dengan alamat aman, lalu coba lagi.');
          return;
        }
        if (!navigator.mediaDevices?.getUserMedia) {
          setNotice('Browser ini tidak menyediakan akses kamera. Coba browser terbaru atau pilih foto dari galeri.');
          return;
        }
      }

      const permission =
        cameraPermission?.granted === true
          ? cameraPermission
          : await requestCameraPermission();
      if (!permission.granted) {
        setNotice(
          Platform.OS === 'web'
            ? 'Akses kamera ditolak. Izinkan kamera untuk situs ini dari ikon gembok/pengaturan browser, lalu coba lagi.'
            : 'Izinkan akses kamera di pengaturan perangkat untuk memotret daun.',
        );
        return;
      }

      setNotice(null);
      setCameraError(null);
      setIsCameraReady(false);
      setIsCameraOpen(true);
    } catch (error) {
      console.error('Unable to request camera permission', error);
      setNotice(
        Platform.OS === 'web'
          ? 'Izin kamera tidak dapat diminta. Pastikan situs memakai HTTPS atau localhost dan izin kamera browser aktif.'
          : 'Izin kamera tidak dapat diminta. Periksa pengaturan perangkat lalu coba lagi.',
      );
    }
  };

  const closeCamera = () => {
    setIsCameraOpen(false);
    setIsCameraReady(false);
    setCameraError(null);
  };

  const takePhoto = async () => {
    if (!isCameraReady || isCapturing) {
      return;
    }

    setIsCapturing(true);
    try {
      const photo = await cameraRef.current?.takePictureAsync({
        quality: 0.75,
      });

      if (!photo?.uri) {
        setNotice('Foto belum berhasil diambil. Silakan coba lagi.');
        return;
      }

      setIsCameraOpen(false);
      setIsCameraReady(false);
      setPendingImage(photo.uri);
      setPendingImageSource('camera');
      setNotice(null);
    } catch (error) {
      console.error('Unable to capture a camera photo', error);
      setNotice('Foto belum berhasil diambil. Arahkan kamera lalu coba lagi.');
    } finally {
      setIsCapturing(false);
    }
  };

  const handleGallery = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.75,
      });

      if (!result.canceled) {
        const photo = result.assets[0];
        if (photo) {
          setPendingImage(photo.uri);
          setPendingImageSource('upload');
          setNotice(null);
        }
      }
    } catch (error) {
      console.error('Unable to open the photo library', error);
      setNotice('Galeri tidak dapat dibuka. Silakan coba lagi.');
    }
  };

  const getCameraErrorMessage = (message: string) => {
    if (Platform.OS !== 'web') {
      return 'Preview kamera tidak dapat dimulai. Coba lagi atau pilih foto dari galeri.';
    }

    const normalizedMessage = message.toLowerCase();
    if (normalizedMessage.includes('notallowed') || normalizedMessage.includes('permission')) {
      return 'Akses kamera ditolak browser. Izinkan kamera untuk situs ini melalui ikon gembok/pengaturan browser, kemudian tekan Coba lagi.';
    }
    if (normalizedMessage.includes('notfound') || normalizedMessage.includes('device')) {
      return 'Kamera tidak ditemukan. Pastikan perangkat memiliki kamera dan tidak sedang dinonaktifkan.';
    }
    if (normalizedMessage.includes('notreadable') || normalizedMessage.includes('could not start')) {
      return 'Kamera sedang dipakai aplikasi lain atau tidak dapat diakses. Tutup aplikasi lain yang memakai kamera, lalu coba lagi.';
    }
    if (normalizedMessage.includes('secure') || normalizedMessage.includes('security')) {
      return 'Kamera web hanya bisa digunakan melalui HTTPS atau localhost.';
    }
    return 'Preview kamera tidak dapat dimulai. Pastikan izin kamera browser aktif dan kamera tidak sedang digunakan aplikasi lain.';
  };

  if (isCameraOpen) {
    return (
      <View style={styles.cameraScreen}>
        <CameraView
          key={cameraAttempt}
          ref={cameraRef}
          style={styles.cameraPreview}
          facing="back"
          mode="picture"
          onCameraReady={() => setIsCameraReady(true)}
          onMountError={(event) => {
            console.error('Camera preview failed to mount', event.message);
            setIsCameraReady(false);
            setCameraError(getCameraErrorMessage(event.message));
          }}
        />
        <SafeAreaView style={styles.cameraOverlay} edges={['top', 'left', 'right', 'bottom']}>
          <View style={styles.cameraTopBar}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Tutup kamera"
              onPress={closeCamera}
              style={({ pressed }) => [styles.cameraCloseButton, pressed && styles.pressed]}>
              <Text style={styles.cameraCloseText}>×</Text>
            </Pressable>
            <View style={styles.cameraTitlePill}>
              <View style={styles.cameraLiveDot} />
              <Text style={styles.cameraTitle}>KAMERA DAUN</Text>
            </View>
            <View style={styles.cameraHeaderSpacer} />
          </View>

          <View style={styles.cameraCenter}>
            {cameraError && (
              <View style={styles.cameraErrorCard}>
                <Text style={styles.cameraErrorTitle}>Kamera belum bisa dibuka</Text>
                <Text style={styles.cameraNoticeText}>{cameraError}</Text>
                <View style={styles.cameraErrorActions}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      setCameraError(null);
                      setIsCameraReady(false);
                      setCameraAttempt((attempt) => attempt + 1);
                    }}
                    style={({ pressed }) => [styles.cameraRetryButton, pressed && styles.pressed]}>
                    <Text style={styles.cameraRetryText}>Coba lagi</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      closeCamera();
                      handleGallery();
                    }}
                    style={({ pressed }) => [styles.cameraFallbackButton, pressed && styles.pressed]}>
                    <Text style={styles.cameraRetryText}>Pilih dari galeri</Text>
                  </Pressable>
                </View>
              </View>
            )}
            {notice && (
              <View style={styles.cameraNotice}>
                <Text style={styles.cameraNoticeText}>{notice}</Text>
              </View>
            )}
            {!cameraError && (
              <>
                <View style={[styles.focusFrame, { width: cameraFrameWidth }]}>
                  <View style={[styles.focusCorner, styles.focusTopLeft]} />
                  <View style={[styles.focusCorner, styles.focusTopRight]} />
                  <View style={[styles.focusCorner, styles.focusBottomLeft]} />
                  <View style={[styles.focusCorner, styles.focusBottomRight]} />
                </View>
                <View style={styles.focusHint}>
                  <Text style={styles.focusHintText}>Posisikan daun di dalam bingkai</Text>
                </View>
              </>
            )}
          </View>

          <View style={styles.cameraBottomBar}>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                closeCamera();
                handleGallery();
              }}
              style={({ pressed }) => [styles.cameraGalleryButton, pressed && styles.pressed]}>
              <ActionIcon name="gallery" color={palette.white} size={22} />
              <Text style={styles.cameraGalleryLabel}>Galeri</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Ambil foto daun"
              onPress={takePhoto}
              disabled={!isCameraReady || isCapturing}
              style={({ pressed }) => [
                styles.shutterOuter,
                (!isCameraReady || isCapturing) && styles.shutterDisabled,
                pressed && styles.pressed,
              ]}>
              <View style={styles.shutterInner} />
            </Pressable>
            <View style={styles.cameraBottomSpacer} />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.page}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}>
        <View
          style={[
            styles.header,
            { paddingHorizontal: horizontalGutter },
          ]}>
          <View style={styles.brandMark}>
            <Text style={styles.brandLeaf}>✿</Text>
          </View>
          <View style={styles.brandCopy}>
            <Text style={styles.brandName}>ramu</Text>
            <Text style={styles.brandSubtitle}>TEMAN TANAMAN OBAT</Text>
          </View>
          <View style={styles.onlinePill}>
            <View style={styles.onlineDot} />
            <Text style={styles.onlineText}>Siap membantu</Text>
          </View>
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingHorizontal: horizontalGutter },
          ]}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
          {!isKeyboardVisible && (
            <>
              <View style={styles.heroCard}>
                <View style={styles.heroTopline}>
                  <View style={styles.demoBadge}>
                    <View style={styles.demoDot} />
                    <Text style={styles.demoText}>MODE DEMO</Text>
                  </View>
                  <Text style={styles.heroDecoration}>✳</Text>
                </View>
                <Text style={styles.heroTitle}>Kebaikan alam,{'\n'}lebih dekat.</Text>
                <Text style={styles.heroDescription}>
                  Kenali tanaman herbal dan cara pemanfaatannya dengan bijak.
                </Text>
                <View style={styles.heroFooter}>
                  <View style={styles.heroDivider} />
                  <Text style={styles.heroCaption}>TANYA · FOTO</Text>
                </View>
              </View>

              <View style={styles.quickSection}>
                <View style={styles.sectionHeading}>
                  <Text style={styles.sectionTitle}>Mulai dari sini</Text>
                  <Text style={styles.sectionHint}>PILIH PERTANYAAN</Text>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.quickList}>
                  {quickQuestions.map((question) => (
                    <Pressable
                      accessibilityRole="button"
                      key={question}
                      onPress={() => sendMessage(question)}
                      disabled={isResponding}
                      style={({ pressed }) => [
                        styles.quickChip,
                        pressed && styles.pressed,
                        isResponding && styles.disabled,
                      ]}>
                      <Text style={styles.quickChipText}>{question}</Text>
                      <ActionIcon
                        name="northeast"
                        size={14}
                        color={palette.forest}
                      />
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            </>
          )}

          <View style={styles.conversation}>
            <View style={styles.conversationHeading}>
              <Text style={styles.sectionTitle}>Percakapan</Text>
              <View style={styles.mockLabel}>
                <Text style={styles.mockLabelText}>JAWABAN MOCK</Text>
              </View>
            </View>
            {messages.map((message) => (
              <View
                key={message.id}
                style={[
                  styles.messageRow,
                  message.role === 'user' && styles.userMessageRow,
                ]}>
                {message.role === 'assistant' && (
                  <View style={styles.assistantAvatar}>
                    <Text style={styles.assistantAvatarText}>✿</Text>
                  </View>
                )}
                <View
                  style={[
                    styles.messageBubble,
                    message.role === 'assistant'
                      ? styles.assistantBubble
                      : styles.userBubble,
                  ]}>
                  {message.imageUri && (
                    <Image
                      source={{ uri: message.imageUri }}
                      style={[
                        styles.messageImage,
                        {
                          width: isResponsiveLayoutReady
                            ? Math.min(220, windowWidth - (isCompact ? 110 : 130))
                            : 220,
                        },
                      ]}
                    />
                  )}
                  {message.source && message.source !== 'text' && (
                    <Text
                      style={[
                        styles.sourceLabel,
                        message.role === 'user' && styles.userSourceLabel,
                      ]}>
                      {message.source === 'camera'
                        ? 'FOTO DARI KAMERA'
                        : message.source === 'upload'
                          ? 'FOTO DARI GALERI'
                          : 'PERTANYAAN SUARA'}
                    </Text>
                  )}
                  <Text
                    style={[
                      styles.messageText,
                      message.role === 'user' && styles.userMessageText,
                    ]}>
                    {message.text}
                  </Text>
                </View>
              </View>
            ))}
            {isResponding && (
              <View style={styles.messageRow}>
                <View style={styles.assistantAvatar}>
                  <Text style={styles.assistantAvatarText}>✿</Text>
                </View>
                <View style={[styles.messageBubble, styles.assistantBubble, styles.typingBubble]}>
                  <View style={styles.typingDot} />
                  <View style={styles.typingDot} />
                  <View style={styles.typingDot} />
                </View>
              </View>
            )}
          </View>
        </ScrollView>

        <View
          style={[
            styles.composerArea,
            { paddingHorizontal: horizontalGutter },
          ]}>
          {notice && (
            <Pressable
              accessibilityRole="button"
              onPress={() => setNotice(null)}
              style={styles.notice}>
              <Text style={styles.noticeText}>{notice}</Text>
              <Text style={styles.noticeClose}>×</Text>
            </Pressable>
          )}
          {pendingImage && (
            <View style={styles.pendingImageCard}>
              <Image
                source={{ uri: pendingImage }}
                style={styles.pendingImagePreview}
                contentFit="cover"
              />
              <View style={styles.pendingImageCopy}>
                <Text style={styles.pendingImageTitle}>
                  {pendingImageSource === 'camera'
                    ? 'Foto kamera siap dikirim'
                    : 'Foto galeri siap dikirim'}
                </Text>
                <Text style={styles.pendingImageHint}>Tambahkan pertanyaan tentang foto ini</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Hapus foto terpilih"
                onPress={() => {
                  setPendingImage(null);
                  setPendingImageSource(null);
                }}
                style={({ pressed }) => [styles.removeImageButton, pressed && styles.pressed]}>
                <Text style={styles.removeImageText}>×</Text>
              </Pressable>
            </View>
          )}
          <View style={[styles.composer, isNarrow && styles.composerNarrow]}>
            <TextInput
              accessibilityLabel="Tulis pertanyaan tentang tanaman obat"
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={submitDraft}
              submitBehavior="submit"
              blurOnSubmit={Platform.OS === 'web'}
              placeholder={
                pendingImage
                  ? 'Tanya sesuatu tentang foto ini...'
                  : 'Tanya tentang tanaman obat...'
              }
              placeholderTextColor={palette.muted}
              returnKeyType="send"
              multiline
              maxLength={500}
              style={styles.input}
            />
            <View
              style={[
                styles.composerActions,
                isNarrow && styles.composerActionsNarrow,
              ]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Buka kamera langsung"
                onPress={openCamera}
                style={({ pressed }) => [styles.toolButton, pressed && styles.pressed]}>
                <ActionIcon
                  name="camera"
                  color={palette.forest}
                />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Pilih foto dari galeri"
                onPress={handleGallery}
                style={({ pressed }) => [styles.toolButton, pressed && styles.pressed]}>
                <ActionIcon name="gallery" color={palette.forest} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Kirim pertanyaan"
                onPress={submitDraft}
                disabled={(!draft.trim() && !pendingImage) || isResponding}
                style={({ pressed }) => [
                  styles.sendButton,
                  ((!draft.trim() && !pendingImage) || isResponding) &&
                    styles.sendDisabled,
                  pressed && styles.pressed,
                ]}>
                <ActionIcon
                  name="send"
                  color={palette.white}
                />
              </Pressable>
            </View>
          </View>
          <Text style={styles.disclaimer}>
            Jawaban demo untuk edukasi, bukan pengganti saran tenaga kesehatan.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const palette = {
  forest: '#244C3A',
  deepForest: '#1C3B2E',
  leaf: '#71936C',
  paleLeaf: '#E8EFE3',
  cream: '#F7F8F3',
  white: '#FFFFFF',
  ink: '#25352D',
  muted: '#8D9A90',
  line: '#E7EBE4',
  amber: '#E5B96D',
  alert: '#9B573A',
};

const styles = StyleSheet.create({
  cameraScreen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
    backgroundColor: '#0A100D',
  },
  cameraPreview: {
    ...StyleSheet.absoluteFill,
  },
  cameraOverlay: {
    flex: 1,
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
  },
  cameraTopBar: {
    paddingHorizontal: 20,
    paddingTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cameraCloseButton: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.42)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraCloseText: {
    color: palette.white,
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '300',
  },
  cameraTitlePill: {
    paddingVertical: 9,
    paddingHorizontal: 13,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.42)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  cameraLiveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#B9D79F',
  },
  cameraTitle: {
    color: palette.white,
    fontSize: 9,
    letterSpacing: 1.2,
    fontWeight: '700',
  },
  cameraHeaderSpacer: {
    width: 42,
  },
  cameraCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraNotice: {
    maxWidth: '84%',
    marginBottom: 22,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 13,
    backgroundColor: 'rgba(24,36,28,0.88)',
  },
  cameraNoticeText: {
    color: palette.white,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  cameraErrorCard: {
    width: '86%',
    maxWidth: 430,
    padding: 18,
    borderRadius: 18,
    backgroundColor: 'rgba(24,36,28,0.94)',
    alignItems: 'center',
  },
  cameraErrorTitle: {
    marginBottom: 8,
    color: palette.white,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  cameraErrorActions: {
    marginTop: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  cameraRetryButton: {
    minHeight: 42,
    paddingHorizontal: 15,
    borderRadius: 13,
    justifyContent: 'center',
    backgroundColor: palette.leaf,
  },
  cameraFallbackButton: {
    minHeight: 42,
    paddingHorizontal: 15,
    borderRadius: 13,
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  cameraRetryText: {
    color: palette.white,
    fontSize: 11,
    fontWeight: '700',
  },
  focusFrame: {
    width: '78%',
    maxHeight: 400,
    aspectRatio: 0.78,
  },
  focusCorner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: 'rgba(255,255,255,0.92)',
  },
  focusTopLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 13,
  },
  focusTopRight: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 13,
  },
  focusBottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 13,
  },
  focusBottomRight: {
    right: 0,
    bottom: 0,
    borderRightWidth: 3,
    borderBottomWidth: 3,
    borderBottomRightRadius: 13,
  },
  focusHint: {
    marginTop: 18,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  focusHintText: {
    color: palette.white,
    fontSize: 11,
  },
  cameraBottomBar: {
    minHeight: 128,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.38)',
  },
  cameraGalleryButton: {
    width: 62,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  cameraBottomSpacer: {
    width: 62,
  },
  cameraGalleryLabel: {
    color: palette.white,
    fontSize: 9,
    fontWeight: '600',
  },
  shutterOuter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: palette.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: palette.white,
  },
  shutterDisabled: {
    opacity: 0.4,
  },
  safeArea: {
    flex: 1,
    backgroundColor: palette.cream,
  },
  page: {
    flex: 1,
    alignSelf: 'center',
    width: '100%',
    maxWidth: 760,
  },
  header: {
    height: 72,
    paddingHorizontal: 22,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: palette.line,
  },
  brandMark: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: palette.forest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandLeaf: {
    color: palette.white,
    fontSize: 24,
    lineHeight: 28,
  },
  brandCopy: {
    marginLeft: 11,
  },
  brandName: {
    color: palette.ink,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.7,
  },
  brandSubtitle: {
    marginTop: 1,
    color: palette.muted,
    fontSize: 8,
    letterSpacing: 1.4,
    fontWeight: '700',
  },
  onlinePill: {
    marginLeft: 'auto',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.white,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: palette.leaf,
  },
  onlineText: {
    fontSize: 10,
    color: palette.forest,
    fontWeight: '600',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 28,
    gap: 25,
    alignSelf: 'center',
    width: '100%',
    maxWidth: 760,
  },
  heroCard: {
    minHeight: 218,
    overflow: 'hidden',
    borderRadius: 24,
    padding: 22,
    backgroundColor: palette.deepForest,
  },
  heroTopline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  demoBadge: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 9,
    gap: 6,
  },
  demoDot: {
    height: 6,
    width: 6,
    borderRadius: 3,
    backgroundColor: palette.amber,
  },
  demoText: {
    color: '#E6EEE5',
    fontSize: 9,
    letterSpacing: 1.1,
    fontWeight: '700',
  },
  heroDecoration: {
    position: 'absolute',
    right: 2,
    top: -19,
    color: 'rgba(197,218,180,0.19)',
    fontSize: 116,
  },
  heroTitle: {
    marginTop: 18,
    color: palette.white,
    fontSize: 30,
    lineHeight: 35,
    letterSpacing: -0.8,
    fontWeight: '600',
  },
  heroDescription: {
    marginTop: 8,
    maxWidth: 285,
    color: '#D5E0D5',
    fontSize: 12,
    lineHeight: 18,
  },
  heroFooter: {
    marginTop: 'auto',
    paddingTop: 17,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  heroDivider: {
    width: 22,
    height: 1,
    backgroundColor: palette.amber,
  },
  heroCaption: {
    color: '#C6D4C7',
    fontSize: 9,
    letterSpacing: 1.4,
    fontWeight: '700',
  },
  quickSection: {
    gap: 12,
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  sectionHint: {
    color: palette.muted,
    fontSize: 8,
    letterSpacing: 1,
    fontWeight: '700',
  },
  quickList: {
    gap: 8,
    paddingRight: 20,
  },
  quickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 38,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#DEE7D9',
    backgroundColor: '#F0F4EC',
  },
  quickChipText: {
    color: palette.forest,
    fontSize: 11,
    fontWeight: '600',
  },
  conversation: {
    gap: 13,
  },
  conversationHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 1,
  },
  mockLabel: {
    paddingVertical: 5,
    paddingHorizontal: 8,
    backgroundColor: '#F0F2EC',
    borderRadius: 8,
  },
  mockLabelText: {
    color: '#7D897D',
    fontSize: 8,
    letterSpacing: 0.8,
    fontWeight: '700',
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  userMessageRow: {
    justifyContent: 'flex-end',
  },
  assistantAvatar: {
    width: 27,
    height: 27,
    borderRadius: 10,
    backgroundColor: palette.paleLeaf,
    alignItems: 'center',
    justifyContent: 'center',
  },
  assistantAvatarText: {
    color: palette.forest,
    fontSize: 17,
  },
  messageBubble: {
    maxWidth: '84%',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 17,
  },
  assistantBubble: {
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: palette.line,
    borderBottomLeftRadius: 5,
  },
  userBubble: {
    backgroundColor: palette.forest,
    borderBottomRightRadius: 5,
  },
  messageImage: {
    height: 155,
    marginBottom: 9,
    borderRadius: 11,
    backgroundColor: palette.paleLeaf,
  },
  sourceLabel: {
    marginBottom: 6,
    color: palette.leaf,
    fontSize: 8,
    letterSpacing: 0.8,
    fontWeight: '700',
  },
  userSourceLabel: {
    color: '#C8D9C6',
  },
  messageText: {
    color: palette.ink,
    fontSize: 12,
    lineHeight: 19,
  },
  userMessageText: {
    color: palette.white,
  },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 38,
  },
  typingDot: {
    height: 6,
    width: 6,
    borderRadius: 3,
    backgroundColor: '#9AA99B',
  },
  composerArea: {
    paddingTop: 10,
    paddingHorizontal: 16,
    paddingBottom: 4,
    backgroundColor: palette.cream,
    borderTopWidth: 1,
    borderTopColor: palette.line,
  },
  notice: {
    marginHorizontal: 4,
    marginBottom: 9,
    paddingVertical: 9,
    paddingHorizontal: 11,
    borderRadius: 11,
    backgroundColor: '#F9EEE8',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  noticeText: {
    flex: 1,
    color: palette.alert,
    fontSize: 11,
    lineHeight: 16,
  },
  noticeClose: {
    color: palette.alert,
    fontSize: 20,
  },
  pendingImageCard: {
    marginHorizontal: 4,
    marginBottom: 8,
    padding: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#DEE7D9',
    backgroundColor: palette.white,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pendingImagePreview: {
    width: 54,
    height: 54,
    borderRadius: 10,
    backgroundColor: palette.paleLeaf,
  },
  pendingImageCopy: {
    flex: 1,
    gap: 3,
  },
  pendingImageTitle: {
    color: palette.ink,
    fontSize: 11,
    fontWeight: '700',
  },
  pendingImageHint: {
    color: palette.muted,
    fontSize: 10,
  },
  removeImageButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#F3F5F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeImageText: {
    color: palette.ink,
    fontSize: 22,
    lineHeight: 25,
  },
  composer: {
    minHeight: 60,
    padding: 6,
    paddingLeft: 15,
    borderWidth: 1,
    borderColor: '#E0E6DE',
    borderRadius: 19,
    backgroundColor: palette.white,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#203C2C',
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  composerNarrow: {
    alignItems: 'stretch',
    flexDirection: 'column',
    padding: 8,
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 88,
    paddingVertical: 9,
    paddingRight: 8,
    color: palette.ink,
    fontSize: 12,
    lineHeight: 18,
  },
  composerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  composerActionsNarrow: {
    justifyContent: 'space-between',
  },
  toolButton: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    marginLeft: 2,
    backgroundColor: palette.forest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: {
    backgroundColor: '#A8B5AA',
  },
  disclaimer: {
    paddingTop: 7,
    paddingBottom: 2,
    color: palette.muted,
    fontSize: 9,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.72,
  },
  disabled: {
    opacity: 0.55,
  },
});
