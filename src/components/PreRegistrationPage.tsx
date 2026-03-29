import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Checkbox } from './ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from './ui/select';
import {
  GraduationCap, ArrowLeft, ArrowRight, Upload, Loader2, CheckCircle,
  FileText, ClipboardList, CreditCard, Search, AlertCircle, Copy, Check, ShieldCheck
} from 'lucide-react';
import { preRegistrationService } from '../services/preregistration.service';

interface PreRegistrationPageProps {
  onBack: () => void;
}

type Step = 'info' | 'options' | 'assessment' | 'payment' | 'complete';

const STEPS: { key: Step; label: string; icon: any }[] = [
  { key: 'info', label: 'Your Information', icon: ClipboardList },
  { key: 'options', label: 'Learning Options', icon: GraduationCap },
  { key: 'assessment', label: 'Estimated Assessment', icon: FileText },
  { key: 'payment', label: 'Payment', icon: CreditCard },
  { key: 'complete', label: 'Complete', icon: CheckCircle },
];

const ADMISSION_TYPES = ['New', 'Transferee', 'Returning'];
const MODALITIES = ['Face-to-Face', 'Online', 'Blended'];
const PAYMENT_TERMS = ['Full', 'Installment (2 terms)', 'Installment (3 terms)'];
const AWARENESS_SOURCES = ['Referral', 'Career Talk', 'Building Signage', 'Facebook', 'Website', 'Other'];
const DEFAULT_UNITS = 21; // first-year default subject load

export default function PreRegistrationPage({ onBack }: PreRegistrationPageProps) {
  const [currentStep, setCurrentStep] = useState<Step>('info');
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [referenceId, setReferenceId] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  // Phase 1: Personal Info
  const [form, setForm] = useState({
    first_name: '', middle_name: '', last_name: '', suffix: '',
    email: '', contact_number: '', birth_date: '', gender: '', address: '',
    admission_type: 'New', source_of_awareness: '',
  });

  // Phase 1: Learning Options
  const [options, setOptions] = useState({
    learning_modality: 'Face-to-Face',
    course: '',
    payment_terms: 'Full',
  });

  // Assessment calculated values
  const [assessment, setAssessment] = useState({
    tuition_per_unit: 0, total_units: DEFAULT_UNITS,
    tuition_fee: 0, registration_fee: 0, library_fee: 0, lab_fee: 0, id_fee: 0, others_fee: 0,
    installment_fee: 0,
    total_assessment: 0,
    amount_due: 0, // registration fee only — what the student actually pays now
  });

  // Phase 2: Payment
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(true);

  useEffect(() => {
    const loadCourses = async () => {
      try {
        const resp = await preRegistrationService.getAvailableCourses();
        setCourses(resp?.data || []);
      } catch (err) {
        console.error('Failed to load courses', err);
        setCourses([
          { course: 'BSIT', tuition_per_unit: 700, registration: 500, library: 500, lab: 2000, id_fee: 200, others: 300 },
          { course: 'BSCS', tuition_per_unit: 700, registration: 500, library: 500, lab: 2000, id_fee: 200, others: 300 },
        ]);
      }
    };
    loadCourses();
  }, []);

  // Recalculate assessment when course or units change
  useEffect(() => {
    if (!options.course) return;
    const courseFee = courses.find((c: any) => c.course === options.course);
    if (!courseFee) return;

    const units = assessment.total_units || DEFAULT_UNITS;
    const tuition = units * (courseFee.tuition_per_unit || 700);
    const reg = courseFee.registration || 500;
    const lib = courseFee.library || 500;
    const lab = courseFee.lab || 2000;
    const idFee = courseFee.id_fee || 200;
    const others = courseFee.others || 300;
    const isInstallment = options.payment_terms !== 'Full';
    const subtotal = tuition + reg + lib + lab + idFee + others;
    const instFee = isInstallment ? Math.round(subtotal * 0.15 * 100) / 100 : 0;
    const total = subtotal + instFee;

    setAssessment(prev => ({
      ...prev,
      tuition_per_unit: courseFee.tuition_per_unit || 700,
      tuition_fee: tuition,
      registration_fee: reg,
      library_fee: lib,
      lab_fee: lab,
      id_fee: idFee,
      others_fee: others,
      installment_fee: instFee,
      total_assessment: total,
      amount_due: reg, // student only pays the registration fee at pre-registration
    }));
  }, [options.course, options.payment_terms, assessment.total_units, courses]);

  const updateForm = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));
  const updateOptions = (field: string, value: string) => setOptions(prev => ({ ...prev, [field]: value }));

  const stepIndex = STEPS.findIndex(s => s.key === currentStep);

  const validateStep = (): boolean => {
    setError('');
    if (currentStep === 'info') {
      if (!form.first_name || !form.last_name || !form.email || !form.contact_number || !form.address || !form.gender) {
        setError('Please fill in all required fields (First Name, Last Name, Email, Contact Number, Address, Sex).');
        return false;
      }
    }
    if (currentStep === 'options') {
      if (!options.course) {
        setError('Please select a course.');
        return false;
      }
    }
    if (currentStep === 'payment') {
      if (!receiptFile) {
        setError('Please upload your payment receipt before proceeding.');
        return false;
      }
    }
    return true;
  };

  const goNext = () => {
    if (!validateStep()) return;
    const nextIdx = stepIndex + 1;
    if (nextIdx < STEPS.length) setCurrentStep(STEPS[nextIdx].key);
  };

  const goPrev = () => {
    const prevIdx = stepIndex - 1;
    if (prevIdx >= 0) setCurrentStep(STEPS[prevIdx].key);
  };

  const handleSubmit = async () => {
    if (!validateStep()) return;
    try {
      setSubmitting(true);
      setError('');

      const fd = new FormData();
      // Phase 1 fields
      Object.entries(form).forEach(([k, v]) => { if (v) fd.append(k, v); });
      Object.entries(options).forEach(([k, v]) => { if (v) fd.append(k, v); });
      // Assessment fields (includes installment_fee and amount_due)
      Object.entries(assessment).forEach(([k, v]) => fd.append(k, String(v)));
      // Receipt
      if (receiptFile) fd.append('receipt', receiptFile);
      // Privacy consent
      fd.append('privacy_consent', String(privacyConsent));

      const resp = await preRegistrationService.submitPreRegistration(fd);
      if (resp.success) {
        setReferenceId(resp.data.reference_id);
        setCurrentStep('complete');
      } else {
        setError(resp.message || 'Submission failed');
      }
    } catch (err: any) {
      setError(err.message || 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const copyRefId = () => {
    navigator.clipboard.writeText(referenceId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatCurrency = (n: number) => '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 2 });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button variant="outline" size="sm" onClick={onBack} className="gap-1">
            <ArrowLeft className="h-4 w-4" /> Back to Login
          </Button>
          <div className="flex items-center gap-3">
            <img src="/Informatics-Logo.png" alt="Logo" className="h-10 w-10 object-contain" />
            <div>
              <h1 className="text-xl font-bold text-blue-600">Informatics College Northgate</h1>
              <p className="text-sm text-slate-500">Pre-Registration Application</p>
            </div>
          </div>
        </div>

        {/* ─── Data Privacy Notice Gate ─── */}
        {showPrivacy && (
          <Card className="p-8 shadow-lg border-0">
            <div className="flex flex-col items-center mb-6">
              <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mb-4">
                <ShieldCheck className="h-8 w-8 text-blue-600" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">Data Privacy Notice</h2>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 mb-6">
              <div className="text-sm text-slate-700 leading-relaxed space-y-4">
                <p>
                  Informatics believes in the sanctity of personal information and the rights of individuals to Data Privacy per <strong>Republic Act 10173 – Data Privacy Act of 2012</strong>. Thus, Informatics is committed to the protection and responsible usage of such information. Informatics will only collect, use, and disclose your personal information with your knowledge and consent.
                </p>
                <p>
                  You may access the complete Data Privacy Act of 2012 at{' '}
                  <a href="https://privacy.gov.ph/data-privacy-act/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-medium">
                    https://privacy.gov.ph/data-privacy-act/
                  </a>
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 bg-white border border-slate-200 rounded-xl mb-6">
              <Checkbox
                id="privacy-consent"
                checked={privacyConsent}
                onCheckedChange={(checked: any) => setPrivacyConsent(checked === true)}
                className="mt-0.5"
              />
              <label htmlFor="privacy-consent" className="text-sm text-slate-700 cursor-pointer flex-1 leading-relaxed">
                I consent to receive marketing communications, updates, and newsletters from Informatics Philippines. I understand my data will be handled in accordance with the Privacy Policy.
              </label>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={onBack} className="gap-1">
                <ArrowLeft className="h-4 w-4" /> Back to Login
              </Button>
              <Button
                onClick={() => setShowPrivacy(false)}
                disabled={!privacyConsent}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 gap-1"
              >
                Proceed <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        )}

        {/* Step Indicator */}
        {!showPrivacy && currentStep !== 'complete' && (
          <div className="flex items-center justify-between mb-8 bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
            {STEPS.filter(s => s.key !== 'complete').map((step, i) => {
              const Icon = step.icon;
              const isActive = stepIndex === i;
              const isDone = stepIndex > i;
              return (
                <div key={step.key} className="flex items-center gap-2 flex-1">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                    isDone ? 'bg-green-500 text-white' : isActive ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-200 text-slate-500'
                  }`}>
                    {isDone ? <CheckCircle className="h-5 w-5" /> : <Icon className="h-4 w-4" />}
                  </div>
                  <span className={`text-xs font-medium hidden sm:block ${isActive ? 'text-blue-600' : isDone ? 'text-green-600' : 'text-slate-400'}`}>
                    {step.label}
                  </span>
                  {i < STEPS.length - 2 && <div className={`flex-1 h-0.5 mx-2 ${isDone ? 'bg-green-400' : 'bg-slate-200'}`} />}
                </div>
              );
            })}
          </div>
        )}

        {!showPrivacy && error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-700">
            <AlertCircle className="h-5 w-5 flex-shrink-0" /> <p className="text-sm">{error}</p>
          </div>
        )}

        {/* ─── STEP 1: Personal Information ─── */}
        {!showPrivacy && currentStep === 'info' && (
          <Card className="p-8 shadow-lg border-0">
            <h2 className="text-xl font-bold mb-1">Personal Information</h2>
            <p className="text-sm text-slate-500 mb-6">Please provide your contact details and basic information.</p>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>First Name <span className="text-red-500">*</span></Label>
                  <Input value={form.first_name} onChange={e => updateForm('first_name', e.target.value.replace(/[^a-zA-ZÀ-ÿ\s-]/g, ''))} className="mt-1" placeholder="Juan" />
                </div>
                <div>
                  <Label>Middle Name</Label>
                  <Input value={form.middle_name} onChange={e => updateForm('middle_name', e.target.value.replace(/[^a-zA-ZÀ-ÿ\s-]/g, ''))} className="mt-1" placeholder="(optional)" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Last Name <span className="text-red-500">*</span></Label>
                  <Input value={form.last_name} onChange={e => updateForm('last_name', e.target.value.replace(/[^a-zA-ZÀ-ÿ\s-]/g, ''))} className="mt-1" placeholder="Dela Cruz" />
                </div>
                <div>
                  <Label>Suffix</Label>
                  <Input value={form.suffix} onChange={e => updateForm('suffix', e.target.value)} className="mt-1" placeholder="Jr., III" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Email <span className="text-red-500">*</span></Label>
                  <Input type="email" value={form.email} onChange={e => updateForm('email', e.target.value)} className="mt-1" placeholder="you@email.com" />
                </div>
                <div>
                  <Label>Contact Number <span className="text-red-500">*</span></Label>
                  <Input value={form.contact_number} onChange={e => updateForm('contact_number', e.target.value.replace(/[^0-9]/g, ''))} className="mt-1" placeholder="09171234567" maxLength={11} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Birth Date</Label>
                  <Input type="date" value={form.birth_date} onChange={e => updateForm('birth_date', e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>Sex <span className="text-red-500">*</span></Label>
                  <Select value={form.gender} onValueChange={(v: string) => updateForm('gender', v)}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Male">Male</SelectItem>
                      <SelectItem value="Female">Female</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Address <span className="text-red-500">*</span></Label>
                <Input value={form.address} onChange={e => updateForm('address', e.target.value)} className="mt-1" placeholder="Complete address" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Admission Type <span className="text-red-500">*</span></Label>
                  <Select value={form.admission_type} onValueChange={(v: string) => updateForm('admission_type', v)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ADMISSION_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>How did you hear about us?</Label>
                  <Select value={form.source_of_awareness} onValueChange={(v: string) => updateForm('source_of_awareness', v)}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {AWARENESS_SOURCES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="flex justify-end mt-8">
              <Button onClick={goNext} className="bg-gradient-to-r from-blue-600 to-indigo-600 gap-1">
                Next <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        )}

        {/* ─── STEP 2: Learning Options ─── */}
        {!showPrivacy && currentStep === 'options' && (
          <Card className="p-8 shadow-lg border-0">
            <h2 className="text-xl font-bold mb-1">Learning Options</h2>
            <p className="text-sm text-slate-500 mb-6">Select your preferred modality, course, and payment terms.</p>

            <div className="space-y-6">
              <div>
                <Label className="text-sm font-semibold">Learning Modality <span className="text-red-500">*</span></Label>
                <div className="grid grid-cols-3 gap-3 mt-2">
                  {MODALITIES.map(m => (
                    <button key={m} onClick={() => updateOptions('learning_modality', m)}
                      className={`p-4 rounded-xl border-2 text-sm font-medium transition-all ${
                        options.learning_modality === m
                          ? 'border-blue-500 bg-blue-50 text-blue-700 shadow'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >{m}</button>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-sm font-semibold">Course / Program <span className="text-red-500">*</span></Label>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  {courses.map((c: any) => (
                    <button key={c.course} onClick={() => updateOptions('course', c.course)}
                      className={`p-4 rounded-xl border-2 text-left transition-all ${
                        options.course === c.course
                          ? 'border-blue-500 bg-blue-50 shadow'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <p className="font-semibold text-sm">{c.course}</p>
                      <p className="text-xs text-slate-500 mt-1">Tuition: ₱{c.tuition_per_unit}/unit</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-sm font-semibold">Estimated Subject Units</Label>
                <Input type="number" min={1} max={30} value={assessment.total_units}
                  onChange={e => setAssessment(prev => ({ ...prev, total_units: parseInt(e.target.value) || DEFAULT_UNITS }))}
                  className="mt-1 w-40" />
                <p className="text-xs text-slate-400 mt-1">Default first-year load is 21 units. Adjust as needed.</p>
              </div>

              <div>
                <Label className="text-sm font-semibold">Payment Terms <span className="text-red-500">*</span></Label>
                <div className="grid grid-cols-3 gap-3 mt-2">
                  {PAYMENT_TERMS.map(pt => (
                    <button key={pt} onClick={() => updateOptions('payment_terms', pt)}
                      className={`p-3 rounded-xl border-2 text-sm font-medium transition-all ${
                        options.payment_terms === pt
                          ? 'border-blue-500 bg-blue-50 text-blue-700 shadow'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >{pt}</button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-between mt-8">
              <Button variant="outline" onClick={goPrev} className="gap-1"><ArrowLeft className="h-4 w-4" /> Back</Button>
              <Button onClick={goNext} className="bg-gradient-to-r from-blue-600 to-indigo-600 gap-1">
                View Estimated Assessment <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        )}

        {/* ─── STEP 3: Estimated Assessment / Matriculation ─── */}
        {!showPrivacy && currentStep === 'assessment' && (
          <Card className="p-8 shadow-lg border-0">
            <h2 className="text-xl font-bold mb-1">Estimated Assessment</h2>
            <p className="text-sm text-slate-500 mb-6">Review your estimated fees below. Final assessment may change upon official enrollment.</p>

            <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
                <h3 className="text-white font-bold text-lg">Estimated Fee Assessment — {options.course}</h3>
                <p className="text-blue-100 text-sm">{options.learning_modality} · {options.payment_terms}</p>
              </div>
              <div className="p-6 space-y-3">
                <div className="flex justify-between py-2 border-b border-slate-200">
                  <span className="text-sm text-slate-600">Tuition ({assessment.total_units} units × {formatCurrency(assessment.tuition_per_unit)}/unit)</span>
                  <span className="font-semibold">{formatCurrency(assessment.tuition_fee)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-200">
                  <span className="text-sm text-slate-600">Registration Fee</span>
                  <span className="font-medium">{formatCurrency(assessment.registration_fee)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-200">
                  <span className="text-sm text-slate-600">Library Fee</span>
                  <span className="font-medium">{formatCurrency(assessment.library_fee)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-200">
                  <span className="text-sm text-slate-600">Laboratory Fee</span>
                  <span className="font-medium">{formatCurrency(assessment.lab_fee)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-200">
                  <span className="text-sm text-slate-600">ID Fee</span>
                  <span className="font-medium">{formatCurrency(assessment.id_fee)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-200">
                  <span className="text-sm text-slate-600">Others / Miscellaneous</span>
                  <span className="font-medium">{formatCurrency(assessment.others_fee)}</span>
                </div>
                {assessment.installment_fee > 0 && (
                  <div className="flex justify-between py-2 border-b border-slate-200">
                    <span className="text-sm text-slate-600">Installment Fee (15%)</span>
                    <span className="font-medium">{formatCurrency(assessment.installment_fee)}</span>
                  </div>
                )}
                <div className="flex justify-between pt-3 mt-2 border-t-2 border-blue-200">
                  <span className="font-bold text-lg">Total Estimated Assessment</span>
                  <span className="font-bold text-lg text-blue-600">{formatCurrency(assessment.total_assessment)}</span>
                </div>

                {/* Registration fee callout — what the student actually pays now */}
                <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="font-semibold text-green-800">Amount Due Now (Registration Fee)</span>
                      <p className="text-xs text-green-700 mt-0.5">Pay the registration fee to secure your slot and receive your student account.</p>
                    </div>
                    <span className="font-bold text-xl text-green-700">{formatCurrency(assessment.amount_due)}</span>
                  </div>
                </div>

                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
                  <strong>Note:</strong> This is an <em>estimated assessment</em>. The remaining balance will be finalized and settled upon official enrollment.
                  {options.payment_terms !== 'Full' && (<> You selected "{options.payment_terms}" — installment breakdowns will be arranged by the cashier upon enrollment.</>)}
                </div>
              </div>
            </div>

            <div className="flex justify-between mt-8">
              <Button variant="outline" onClick={goPrev} className="gap-1"><ArrowLeft className="h-4 w-4" /> Back</Button>
              <Button onClick={goNext} className="bg-gradient-to-r from-blue-600 to-indigo-600 gap-1">
                Proceed to Payment <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        )}

        {/* ─── STEP 4: Payment Upload ─── */}
        {!showPrivacy && currentStep === 'payment' && (
          <Card className="p-8 shadow-lg border-0">
            <h2 className="text-xl font-bold mb-1">Registration Fee Payment</h2>
            <p className="text-sm text-slate-500 mb-6">Pay the registration fee to secure your slot, then upload your receipt below.</p>

            <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #22c55e', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
              <h3 style={{ fontWeight: 600, color: '#1e293b', marginBottom: '8px', fontSize: '15px' }}>Registration Fee — {options.course}</h3>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <span style={{ fontSize: '14px', color: '#334155' }}>Registration Fee (for account creation)</span>
                <span style={{ fontWeight: 700, color: '#16a34a', fontSize: '20px' }}>{formatCurrency(assessment.amount_due)}</span>
              </div>
              <p style={{ fontSize: '12px', color: '#475569', marginTop: '8px' }}>
                Please pay the <strong>registration fee</strong> shown above via bank transfer, GCash, or over-the-counter at the campus cashier. This fee is required to create your student account. The remaining tuition and fees (estimated total: {formatCurrency(assessment.total_assessment)}) will be settled upon official enrollment.
              </p>
            </div>

            <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:border-blue-400 transition-colors">
              {receiptFile ? (
                <div className="space-y-2">
                  <CheckCircle className="h-10 w-10 text-green-500 mx-auto" />
                  <p className="font-medium text-green-700">{receiptFile.name}</p>
                  <p className="text-xs text-slate-500">{(receiptFile.size / 1024 / 1024).toFixed(2)} MB</p>
                  <Button variant="outline" size="sm" onClick={() => setReceiptFile(null)}>Remove & Re-upload</Button>
                </div>
              ) : (
                <label className="cursor-pointer space-y-3 block">
                  <Upload className="h-10 w-10 text-slate-400 mx-auto" />
                  <p className="text-sm text-slate-600">Click to upload or drag and drop</p>
                  <p className="text-xs text-slate-400">JPG, PNG, or PDF — Max 15MB</p>
                  <input type="file" className="hidden" accept=".jpg,.jpeg,.png,.pdf"
                    onChange={e => { const f = e.target.files?.[0]; if (f) setReceiptFile(f); }} />
                </label>
              )}
            </div>

            <div className="flex justify-between mt-8">
              <Button variant="outline" onClick={goPrev} className="gap-1"><ArrowLeft className="h-4 w-4" /> Back</Button>
              <Button onClick={handleSubmit} disabled={submitting}
                style={{ background: 'linear-gradient(to right, #16a34a, #059669)', color: 'white' }}
                className="gap-1">
                {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Submitting...</> : <><CheckCircle className="h-4 w-4" /> Submit Application</>}
              </Button>
            </div>
          </Card>
        )}

        {/* ─── STEP 5: Complete ─── */}
        {!showPrivacy && currentStep === 'complete' && (
          <Card className="p-8 shadow-lg border-0 text-center">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle className="h-10 w-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-green-700 mb-2">Application Submitted!</h2>
            <p className="text-slate-600 mb-6">Your pre-registration has been submitted. Save your Reference ID below to track your application status.</p>

            <div className="inline-flex items-center gap-2 bg-slate-100 border-2 border-slate-300 rounded-xl px-6 py-4 mb-6">
              <span className="text-sm text-slate-500">Reference ID:</span>
              <span className="text-xl font-mono font-bold text-blue-600">{referenceId}</span>
              <Button variant="ghost" size="sm" onClick={copyRefId} className="ml-2">
                {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 max-w-lg mx-auto mb-6">
              <strong>What's Next?</strong>
              <ol className="list-decimal list-inside mt-2 space-y-1 text-left">
                <li>Our cashier will verify your payment receipt.</li>
                <li>Once verified, your application enters the admin queue.</li>
                <li>An admin will create your student account and send your credentials.</li>
                <li>You can then log in using the provided credentials.</li>
              </ol>
            </div>

            <p className="text-sm text-slate-500 mb-4">You can track your status on the login page using your Reference ID.</p>
            <Button onClick={onBack} className="bg-gradient-to-r from-blue-600 to-indigo-600">
              Back to Login
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}
