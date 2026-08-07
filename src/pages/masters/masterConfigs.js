import { Users, Package, Layers, Cog, UserCog, Truck, Wrench } from 'lucide-react'

export const CUSTOMER_TYPES = [
  { value: 'bhel', label: 'BHEL unit' },
  { value: 'allied', label: 'Allied vendor' },
  { value: 'other', label: 'Other' },
]

export const MACHINE_TYPES = [
  { value: 'lathe', label: 'Lathe' },
  { value: 'cnc', label: 'CNC' },
  { value: 'mill', label: 'Milling' },
  { value: 'grind', label: 'Grinding' },
  { value: 'drill', label: 'Drilling' },
  { value: 'other', label: 'Other' },
]

export const UOM_OPTIONS = ['NOS', 'KG', 'M', 'MM', 'L', 'SET', 'EA']

export const masterConfigs = {
  customers: {
    table: 'wms_customers',
    title: 'Customers',
    subtitle: 'BHEL units, allied vendors, and customer codes for PO tracking.',
    icon: Users,
    codeField: 'customer_code',
    codeLabel: 'Customer code',
    nameField: 'name',
    searchHint: 'Search code, name, BHEL vendor code…',
    columns: [
      { key: 'customer_code', label: 'Code', mono: true },
      { key: 'name', label: 'Name' },
      { key: 'customer_type', label: 'Type', format: v => CUSTOMER_TYPES.find(t => t.value === v)?.label || v },
      { key: 'bhel_vendor_code', label: 'BHEL vendor code', mono: true },
      { key: 'city', label: 'City' },
    ],
    fields: [
      { key: 'customer_code', label: 'Customer code', required: true, placeholder: 'e.g. BHEL-TRI' },
      { key: 'name', label: 'Customer name', required: true },
      { key: 'customer_type', label: 'Type', type: 'select', options: CUSTOMER_TYPES, required: true },
      { key: 'bhel_vendor_code', label: 'BHEL vendor code', placeholder: 'If applicable' },
      { key: 'gstin', label: 'GSTIN' },
      { key: 'contact_name', label: 'Contact person' },
      { key: 'phone', label: 'Phone' },
      { key: 'email', label: 'Email' },
      { key: 'address', label: 'Address', type: 'textarea' },
      { key: 'city', label: 'City' },
      { key: 'state', label: 'State' },
      { key: 'pincode', label: 'PIN' },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
    emptyForm: {
      customer_code: '', name: '', customer_type: 'allied', bhel_vendor_code: '',
      gstin: '', contact_name: '', phone: '', email: '',
      address: '', city: '', state: '', pincode: '', notes: '',
    },
  },

  items: {
    table: 'wms_items',
    title: 'Items / parts',
    subtitle: 'Drawing numbers, revisions, material specs, and UOM.',
    icon: Package,
    codeField: 'item_code',
    codeLabel: 'Item code',
    nameField: 'description',
    searchHint: 'Search item code, drawing, description…',
    loadOptions: 'customers',
    columns: [
      { key: 'item_code', label: 'Item code', mono: true },
      { key: 'drawing_number', label: 'Drawing no.', mono: true },
      { key: 'revision', label: 'Rev.' },
      { key: 'description', label: 'Description' },
      { key: 'uom', label: 'UOM' },
    ],
    fields: [
      { key: 'item_code', label: 'Item code', required: true },
      { key: 'drawing_number', label: 'Drawing number' },
      { key: 'revision', label: 'Revision', placeholder: '0' },
      { key: 'description', label: 'Description', required: true },
      { key: 'material_spec', label: 'Material spec' },
      { key: 'uom', label: 'UOM', type: 'select', options: UOM_OPTIONS.map(v => ({ value: v, label: v })), required: true },
      { key: 'default_customer_id', label: 'Default customer', type: 'customer_select' },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
    emptyForm: {
      item_code: '', drawing_number: '', revision: '0', description: '',
      material_spec: '', uom: 'NOS', default_customer_id: '', notes: '',
    },
  },

  materials: {
    table: 'wms_materials',
    title: 'Materials',
    subtitle: 'Raw material grades and specifications for inward/issue.',
    icon: Layers,
    codeField: 'material_code',
    codeLabel: 'Material code',
    nameField: 'name',
    searchHint: 'Search material code or name…',
    columns: [
      { key: 'material_code', label: 'Code', mono: true },
      { key: 'name', label: 'Name' },
      { key: 'grade', label: 'Grade' },
      { key: 'uom', label: 'UOM' },
    ],
    fields: [
      { key: 'material_code', label: 'Material code', required: true },
      { key: 'name', label: 'Name', required: true },
      { key: 'grade', label: 'Grade' },
      { key: 'specification', label: 'Specification', type: 'textarea' },
      { key: 'uom', label: 'UOM', type: 'select', options: UOM_OPTIONS.map(v => ({ value: v, label: v })), required: true },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
    emptyForm: {
      material_code: '', name: '', grade: '', specification: '', uom: 'KG', notes: '',
    },
  },

  machines: {
    table: 'wms_machines',
    title: 'Machines',
    subtitle: 'Shop equipment — type, location, and capacity notes.',
    icon: Cog,
    codeField: 'machine_code',
    codeLabel: 'Machine code',
    nameField: 'name',
    searchHint: 'Search machine code or name…',
    columns: [
      { key: 'machine_code', label: 'Code', mono: true },
      { key: 'name', label: 'Name' },
      { key: 'machine_type', label: 'Type', format: v => MACHINE_TYPES.find(t => t.value === v)?.label || v },
      { key: 'location', label: 'Location' },
    ],
    fields: [
      { key: 'machine_code', label: 'Machine code', required: true },
      { key: 'name', label: 'Machine name', required: true },
      { key: 'machine_type', label: 'Type', type: 'select', options: MACHINE_TYPES, required: true },
      { key: 'location', label: 'Location' },
      { key: 'capacity_description', label: 'Capacity / notes', type: 'textarea' },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
    emptyForm: {
      machine_code: '', name: '', machine_type: 'other', location: '',
      capacity_description: '', notes: '',
    },
  },

  operators: {
    table: 'wms_operators',
    title: 'Operators',
    subtitle: 'Shop-floor operators (separate from system login users).',
    icon: UserCog,
    codeField: 'employee_code',
    codeLabel: 'Employee code',
    nameField: 'full_name',
    searchHint: 'Search employee code or name…',
    columns: [
      { key: 'employee_code', label: 'Code', mono: true },
      { key: 'full_name', label: 'Name' },
      { key: 'designation', label: 'Designation' },
      { key: 'skill_level', label: 'Skill' },
    ],
    fields: [
      { key: 'employee_code', label: 'Employee code', required: true },
      { key: 'full_name', label: 'Full name', required: true },
      { key: 'designation', label: 'Designation' },
      { key: 'skill_level', label: 'Skill level' },
      { key: 'phone', label: 'Phone' },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
    emptyForm: {
      employee_code: '', full_name: '', designation: '', skill_level: '', phone: '', notes: '',
    },
  },

  subcontractors: {
    table: 'wms_subcontractors',
    title: 'Subcontractors',
    subtitle: 'Plating, heat treatment, and other outside processes.',
    icon: Truck,
    codeField: 'vendor_code',
    codeLabel: 'Vendor code',
    nameField: 'name',
    searchHint: 'Search vendor code or name…',
    columns: [
      { key: 'vendor_code', label: 'Code', mono: true },
      { key: 'name', label: 'Name' },
      { key: 'process_type', label: 'Process' },
      { key: 'phone', label: 'Phone' },
    ],
    fields: [
      { key: 'vendor_code', label: 'Vendor code', required: true },
      { key: 'name', label: 'Name', required: true },
      { key: 'process_type', label: 'Process type', placeholder: 'Plating, HT, …' },
      { key: 'contact_name', label: 'Contact' },
      { key: 'phone', label: 'Phone' },
      { key: 'email', label: 'Email' },
      { key: 'address', label: 'Address', type: 'textarea' },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
    emptyForm: {
      vendor_code: '', name: '', process_type: '', contact_name: '',
      phone: '', email: '', address: '', notes: '',
    },
  },
}

export const toolingPlaceholder = {
  title: 'Tooling & gauges',
  subtitle: 'PDF §1.7 — scheduled for Sprint B (links to QC calibration).',
  icon: Wrench,
}
