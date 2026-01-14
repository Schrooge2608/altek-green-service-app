

'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon } from 'lucide-react';
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { doc, collection } from 'firebase/firestore';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import type { User, Equipment, VSD } from '@/lib/types';
import backendConfig from '@/docs/backend.json';
import { Combobox } from '@/components/ui/combobox';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';


const formSchema = z.object({
  equipmentId: z.string().min(1, 'Equipment ID is required'),
  equipmentName: z.string().min(1, 'Equipment name is required'),
  plant: z.enum(['Mining', 'Smelter']),
  division: z.enum(["Boosters", "Dredgers", "Pump Stations", "MSP", "Roaster", "Char Plant", "Smelter", "Iron injection", "Stripping Crane", "Slag plant", "North Screen", "UPS/BTU's"]).optional(),
  location: z.string().min(1, 'Location is required'),
  imageUrl: z.string().optional(),
  
  // VSD fields
  vsdId: z.string().min(1, 'VSD ID is required'),
  model: z.string().min(1, 'VSD Model is required'),
  serialNumber: z.string().min(1, 'VSD Serial number is required'),
  installationDate: z.date({
    required_error: "An installation date is required.",
  }),
  assignedToId: z.string().optional(),

  // Motor fields
  motorModel: z.string().optional(),
  motorPower: z.coerce.number().optional(),
  motorVoltage: z.coerce.number().optional(),
  motorSerialNumber: z.string().optional(),
  motorFrameType: z.string().optional(),
  motorInstallationDate: z.date().optional(),
  motorAssignedToId: z.string().optional(),

  // Protection fields
  breakerAssetNumber: z.string().optional(),
  breakerLocationHierarchy: z.string().optional(),
  breakerServiceDescription: z.string().optional(),
  breakerManufacturer: z.string().optional(),
  breakerModelRange: z.string().optional(),
  breakerType: z.enum(['MCB', 'MCCB', 'ACB', 'VCB']).optional(),
  breakerRatedVoltage: z.coerce.number().optional(),
  breakerFrameSize: z.coerce.number().optional(),
  breakerBreakingCapacity: z.coerce.number().optional(),
  breakerNumberOfPoles: z.enum(['3', '4']).optional(),
  breakerTripUnitType: z.enum(['Thermal-Magnetic', 'Electronic']).optional(),
  breakerOverloadSetting: z.coerce.number().optional(),
  breakerShortCircuitSetting: z.coerce.number().optional(),
  breakerInstantaneousSetting: z.coerce.number().optional(),
  breakerGroundFaultSetting: z.string().optional(),
  breakerOperationMechanism: z.enum(['Manual', 'Motorized']).optional(),
  breakerMotorVoltage: z.coerce.number().optional(),
  breakerShuntTripVoltage: z.coerce.number().optional(),
  breakerUndervoltageRelease: z.enum(['Yes', 'No']).optional(),
  breakerAuxiliaryContacts: z.string().optional(),
  protectionInstallationDate: z.date().optional(),
  protectionAssignedToId: z.string().optional(),

  // UPS/BTU fields
  upsModel: z.string().optional(),
  upsSerialNumber: z.string().optional(),
  batteryType: z.string().optional(),
  upsInstallationDate: z.date().optional(),
  lastBatteryReplacement: z.date().optional(),
  upsAssignedToId: z.string().optional(),

  // Pump fields
  pumpType: z.string().optional(),
  pumpBrand: z.string().optional(),
  pumpSerialNumber: z.string().optional(),
  pumpManufacturer: z.string().optional(),
  pumpHead: z.coerce.number().optional(),
  flowRate: z.coerce.number().optional(),
  pumpImpellerDiameter: z.coerce.number().optional(),
  pumpCommissionDate: z.date().optional(),
  pumpFlangeSizeIn: z.coerce.number().optional(),
  pumpFlangeSizeOutlet: z.coerce.number().optional(),
  pumpFrameSize: z.string().optional(),
  pumpFrameType: z.string().optional(),
  pumpAssignedToId: z.string().optional(),
});

const dredgerLocations = ['MPA','MPC','MPD','MPE', "MPC DRY MINING"];

export default function NewEquipmentPage() {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  
  const usersQuery = useMemoFirebase(() => (user ? collection(firestore, 'users') : null), [firestore, user]);
  const { data: users, isLoading: usersLoading } = useCollection<User>(usersQuery);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      equipmentId: '',
      equipmentName: '',
      location: '',
      imageUrl: '',
      vsdId: '',
      serialNumber: '',
      model: '',
    },
  });

  const watchedPlant = useWatch({
    control: form.control,
    name: 'plant',
  });
  
  const watchedDivision = useWatch({
    control: form.control,
    name: 'division',
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    if (values.plant === 'Mining' && !values.division) {
        form.setError('division', { type: 'manual', message: 'Please select a division for the Mining plant.' });
        return;
    }
    
    const assignedUser = users?.find(u => u.id === values.assignedToId);
    const protectionAssignedUser = users?.find(u => u.id === values.protectionAssignedToId);
    const upsAssignedUser = users?.find(u => u.id === values.upsAssignedToId);
    const motorAssignedUser = users?.find(u => u.id === values.motorAssignedToId);
    const pumpAssignedUser = users?.find(u => u.id === values.pumpAssignedToId);

    const equipmentRef = doc(firestore, 'equipment', values.equipmentId);
    const vsdRef = doc(firestore, 'vsds', values.vsdId);

    const equipmentData: Partial<Equipment> = {
      id: values.equipmentId,
      name: values.equipmentName,
      plant: values.plant,
      vsdId: values.vsdId,
      location: values.location,
      imageUrl: values.imageUrl,
      lastMaintenance: format(new Date(), "yyyy-MM-dd"),
      nextMaintenance: format(new Date(new Date().setMonth(new Date().getMonth() + 3)), "yyyy-MM-dd"),
      uptime: 100,
      powerConsumption: 0,
      totalDowntimeHours: 0,
      
      breakerAssetNumber: values.breakerAssetNumber,
      breakerLocationHierarchy: values.breakerLocationHierarchy,
      breakerServiceDescription: values.breakerServiceDescription || '',
      breakerManufacturer: values.breakerManufacturer,
      breakerModelRange: values.breakerModelRange,
      breakerType: values.breakerType,
      breakerRatedVoltage: values.breakerRatedVoltage,
      breakerFrameSize: values.breakerFrameSize,
      breakerBreakingCapacity: values.breakerBreakingCapacity,
      breakerNumberOfPoles: values.breakerNumberOfPoles ? parseInt(values.breakerNumberOfPoles) as 3 | 4 : undefined,
      breakerTripUnitType: values.breakerTripUnitType,
      breakerOverloadSetting: values.breakerOverloadSetting,
      breakerShortCircuitSetting: values.breakerShortCircuitSetting,
      breakerInstantaneousSetting: values.breakerInstantaneousSetting,
      breakerGroundFaultSetting: values.breakerGroundFaultSetting,
      breakerOperationMechanism: values.breakerOperationMechanism,
      breakerMotorVoltage: values.breakerMotorVoltage,
      breakerShuntTripVoltage: values.breakerShuntTripVoltage,
      breakerUndervoltageRelease: values.breakerUndervoltageRelease,
      breakerAuxiliaryContacts: values.breakerAuxiliaryContacts,
      protectionInstallationDate: values.protectionInstallationDate ? format(values.protectionInstallationDate, "yyyy-MM-dd") : undefined,
      protectionAssignedToId: values.protectionAssignedToId,
      protectionAssignedToName: protectionAssignedUser?.name,

      upsModel: values.upsModel,
      upsSerialNumber: values.upsSerialNumber,
      batteryType: values.batteryType,
      upsInstallationDate: values.upsInstallationDate ? format(values.upsInstallationDate, "yyyy-MM-dd") : undefined,
      lastBatteryReplacement: values.lastBatteryReplacement ? format(values.lastBatteryReplacement, "yyyy-MM-dd") : undefined,
      upsAssignedToId: values.upsAssignedToId,
      upsAssignedToName: upsAssignedUser?.name,

      motorModel: values.motorModel,
      motorPower: values.motorPower,
      motorVoltage: values.motorVoltage,
      motorSerialNumber: values.motorSerialNumber,
      motorFrameType: values.motorFrameType,
      motorInstallationDate: values.motorInstallationDate ? format(values.motorInstallationDate, "yyyy-MM-dd") : undefined,
      motorAssignedToId: values.motorAssignedToId,
      motorAssignedToName: motorAssignedUser?.name,

      pumpType: values.pumpType,
      pumpBrand: values.pumpBrand,
      pumpSerialNumber: values.pumpSerialNumber,
      pumpManufacturer: values.pumpManufacturer,
      pumpHead: values.pumpHead,
      flowRate: values.flowRate,
      pumpImpellerDiameter: values.pumpImpellerDiameter,
      pumpCommissionDate: values.pumpCommissionDate ? format(values.pumpCommissionDate, "yyyy-MM-dd") : undefined,
      pumpFlangeSizeIn: values.pumpFlangeSizeIn,
      pumpFlangeSizeOutlet: values.pumpFlangeSizeOutlet,
      pumpFrameSize: values.pumpFrameSize,
      pumpFrameType: values.pumpFrameType,
      pumpAssignedToId: values.pumpAssignedToId,
      pumpAssignedToName: pumpAssignedUser?.name,
    };

    if (values.plant === 'Mining' || values.plant === 'Smelter') {
        equipmentData.division = values.division;
    }

    const vsdData: VSD = {
        id: values.vsdId,
        equipmentId: values.equipmentId,
        model: values.model,
        serialNumber: values.serialNumber,
        installationDate: format(values.installationDate, "yyyy-MM-dd"),
        status: 'active',
        assignedToId: values.assignedToId || '',
        assignedToName: assignedUser?.name || '',
    };

    setDocumentNonBlocking(equipmentRef, equipmentData, { merge: true });
    setDocumentNonBlocking(vsdRef, vsdData, { merge: true });

    toast({
      title: 'Equipment Added',
      description: `Equipment ${values.equipmentName} has been successfully added.`,
    });
    form.reset();
  }

  const miningDivisions = (backendConfig.entities.Equipment.properties.division.enum || []).filter(d => ["Boosters", "Dredgers", "Pump Stations"].includes(d));
  const smelterDivisions = (backendConfig.entities.Equipment.properties.division.enum || []).filter(d => !["Boosters", "Dredgers", "Pump Stations"].includes(d));


  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Add New Equipment</h1>
        <p className="text-muted-foreground">
          Capture data for a new equipment cluster.
        </p>
      </header>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
           <Card>
            <CardHeader>
              <CardTitle>Equipment Details</CardTitle>
              <CardDescription>Information about the main equipment unit.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
              <FormField
                control={form.control}
                name="equipmentId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Equipment ID</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., pump-003" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="equipmentName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Equipment Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Coolant Pump B" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="plant"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Plant</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a plant" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Mining">Mining</SelectItem>
                        <SelectItem value="Smelter">Smelter</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {watchedPlant === 'Mining' && (
                <FormField
                  control={form.control}
                  name="division"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Division</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a division" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {miningDivisions.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
               {watchedPlant === 'Smelter' && (
                <FormField
                  control={form.control}
                  name="division"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Division</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a division" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {smelterDivisions.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
               {watchedPlant === 'Mining' && watchedDivision === 'Dredgers' ? (
                 <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location (Plant Heading)</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a location" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {dredgerLocations.map(loc => <SelectItem key={loc} value={loc}>{loc}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
               ) : (
                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Sector C, Line 2" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              <div className="md:col-span-2">
                <FormField
                    control={form.control}
                    name="imageUrl"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Image</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                                <SelectTrigger>
                                <SelectValue placeholder="Select an image for the equipment" />
                                </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                {PlaceHolderImages.map(img => <SelectItem key={img.id} value={img.imageUrl}>{img.description}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                    )}
                />
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Card>
              <CardHeader>
                  <CardTitle>Protection Details</CardTitle>
                  <CardDescription>Circuit breaker identification, ratings, and settings.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h4 className="mb-4 font-medium text-sm text-muted-foreground">Identification & Location</h4>
                  <div className="grid gap-4">
                    <FormField control={form.control} name="breakerAssetNumber" render={({ field }) => (<FormItem><FormLabel>Asset Number / Tag ID</FormLabel><FormControl><Input placeholder="e.g., CB-SUB01-F03" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="breakerLocationHierarchy" render={({ field }) => (<FormItem><FormLabel>Location / Hierarchy</FormLabel><FormControl><Input placeholder="Substation > DB > Cubicle" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="breakerServiceDescription" render={({ field }) => (<FormItem><FormLabel>Service / Description</FormLabel><FormControl><Textarea placeholder="What does it feed? e.g., Conveyor 3 Main Drive" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="breakerManufacturer" render={({ field }) => (<FormItem><FormLabel>Manufacturer</FormLabel><FormControl><Input placeholder="e.g., Schneider, ABB" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="breakerModelRange" render={({ field }) => (<FormItem><FormLabel>Model Range</FormLabel><FormControl><Input placeholder="e.g., Masterpact NW" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="breakerType" render={({ field }) => (<FormItem><FormLabel>Type</FormLabel><Select onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue placeholder="Select type..." /></SelectTrigger></FormControl><SelectContent><SelectItem value="MCB">MCB (Miniature)</SelectItem><SelectItem value="MCCB">MCCB (Moulded Case)</SelectItem><SelectItem value="ACB">ACB (Air)</SelectItem><SelectItem value="VCB">VCB (Vacuum)</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                  </div>
                </div>
                <Separator/>
                <div>
                  <h4 className="mb-4 font-medium text-sm text-muted-foreground">Electrical Ratings (Hard Limits)</h4>
                   <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="breakerRatedVoltage" render={({ field }) => (<FormItem><FormLabel>Rated Voltage (V)</FormLabel><FormControl><Input type="number" placeholder="e.g., 525" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="breakerFrameSize" render={({ field }) => (<FormItem><FormLabel>Frame Size (A)</FormLabel><FormControl><Input type="number" placeholder="e.g., 400" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="breakerBreakingCapacity" render={({ field }) => (<FormItem><FormLabel>Breaking Capacity (kA)</FormLabel><FormControl><Input type="number" placeholder="e.g., 36" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="breakerNumberOfPoles" render={({ field }) => (<FormItem><FormLabel>Number of Poles</FormLabel><Select onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger></FormControl><SelectContent><SelectItem value="3">3-Pole</SelectItem><SelectItem value="4">4-Pole</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                  </div>
                </div>
                <Separator/>
                 <div>
                  <h4 className="mb-4 font-medium text-sm text-muted-foreground">Protection Settings (Soft Limits)</h4>
                   <div className="grid grid-cols-2 gap-4">
                      <FormField control={form.control} name="breakerTripUnitType" render={({ field }) => (<FormItem className="col-span-2"><FormLabel>Trip Unit Type</FormLabel><Select onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue placeholder="Select trip unit..." /></SelectTrigger></FormControl><SelectContent><SelectItem value="Thermal-Magnetic">Thermal-Magnetic</SelectItem><SelectItem value="Electronic">Electronic (Micrologic, Ekip, etc.)</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name="breakerOverloadSetting" render={({ field }) => (<FormItem><FormLabel>Overload (Ir)</FormLabel><FormControl><Input type="number" placeholder="e.g., 320" {...field} value={field.value ?? ''} /></FormControl><FormDescription>Long-time current</FormDescription><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name="breakerShortCircuitSetting" render={({ field }) => (<FormItem><FormLabel>Short-Circuit (Isd)</FormLabel><FormControl><Input type="number" placeholder="e.g., 5" {...field} value={field.value ?? ''} /></FormControl><FormDescription>Short-time delay</FormDescription><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name="breakerInstantaneousSetting" render={({ field }) => (<FormItem><FormLabel>Instantaneous (Ii)</FormLabel><FormControl><Input type="number" placeholder="e.g., 10" {...field} value={field.value ?? ''} /></FormControl><FormDescription>Immediate trip</FormDescription><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name="breakerGroundFaultSetting" render={({ field }) => (<FormItem><FormLabel>Ground Fault (Ig)</FormLabel><FormControl><Input placeholder="Sensitivity (A) & Time (s)" {...field} value={field.value ?? ''} /></FormControl><FormDescription>Is it enabled?</FormDescription><FormMessage /></FormItem>)} />
                   </div>
                </div>
                <Separator/>
                <div>
                  <h4 className="mb-4 font-medium text-sm text-muted-foreground">Accessories & Control</h4>
                   <div className="grid grid-cols-2 gap-4">
                     <FormField control={form.control} name="breakerOperationMechanism" render={({ field }) => (<FormItem><FormLabel>Operation Mechanism</FormLabel><Select onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger></FormControl><SelectContent><SelectItem value="Manual">Manual (Handle)</SelectItem><SelectItem value="Motorized">Motorized (Electrical)</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                     <FormField control={form.control} name="breakerMotorVoltage" render={({ field }) => (<FormItem><FormLabel>Motor Voltage (V)</FormLabel><FormControl><Input type="number" placeholder="110, 230, 24" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                     <FormField control={form.control} name="breakerShuntTripVoltage" render={({ field }) => (<FormItem><FormLabel>Shunt Trip Voltage (V)</FormLabel><FormControl><Input type="number" placeholder="e.g., 220" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                     <FormField control={form.control} name="breakerUndervoltageRelease" render={({ field }) => (<FormItem><FormLabel>Undervoltage Release</FormLabel><Select onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger></FormControl><SelectContent><SelectItem value="Yes">Yes</SelectItem><SelectItem value="No">No</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                     <FormField control={form.control} name="breakerAuxiliaryContacts" render={({ field }) => (<FormItem className="col-span-2"><FormLabel>Auxiliary Contacts</FormLabel><FormControl><Input placeholder="e.g., 2 NO + 2 NC" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                  </div>
                </div>
                 <Separator/>
                  <FormField
                      control={form.control}
                      name="protectionInstallationDate"
                      render={({ field }) => (
                      <FormItem className="flex flex-col">
                          <FormLabel>Installation Date</FormLabel>
                          <Popover>
                          <PopoverTrigger asChild>
                              <FormControl>
                              <Button
                                  variant={"outline"}
                                  className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                              >
                                  {field.value ? (format(field.value, "PPP")) : (<span>Pick a date</span>)}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                              </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                              <Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={(date) => date > new Date()} initialFocus />
                          </PopoverContent>
                          </Popover>
                          <FormMessage />
                      </FormItem>
                      )}
                  />
                  <FormField
                      control={form.control}
                      name="protectionAssignedToId"
                      render={({ field }) => (
                      <FormItem>
                          <FormLabel>Assigned Protection Technician</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                  <SelectTrigger>
                                      <SelectValue placeholder="Assign a technician..." />
                                  </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                  {usersLoading ? (
                                      <SelectItem value="loading" disabled>Loading users...</SelectItem>
                                  ) : (
                                      <>
                                          <SelectItem value="unassigned">Unassigned</SelectItem>
                                          {users?.map(user => <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>)}
                                      </>
                                  )}
                              </SelectContent>
                          </Select>
                          <FormMessage />
                      </FormItem>
                      )}
                  />
              </CardContent>
            </Card>

            <div className="space-y-8">
              <Card>
                <CardHeader>
                    <CardTitle>UPS/BTU Details</CardTitle>
                    <CardDescription>Battery backup unit information.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-6">
                    <FormField
                        control={form.control}
                        name="upsModel"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>UPS Model</FormLabel>
                            <FormControl>
                            <Input placeholder="e.g., Eaton 9PX" {...field} value={field.value ?? ''} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="upsSerialNumber"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>UPS Serial Number</FormLabel>
                            <FormControl>
                            <Input placeholder="e.g., SN-UPS-123" {...field} value={field.value ?? ''} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="batteryType"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Battery Type</FormLabel>
                            <FormControl>
                            <Input placeholder="e.g., Lead-Acid, Li-Ion" {...field} value={field.value ?? ''} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="upsInstallationDate"
                        render={({ field }) => (
                        <FormItem className="flex flex-col">
                            <FormLabel>Installation Date</FormLabel>
                            <Popover>
                            <PopoverTrigger asChild>
                                <FormControl>
                                <Button
                                    variant={"outline"}
                                    className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                                >
                                    {field.value ? (format(field.value, "PPP")) : (<span>Pick a date</span>)}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                                </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={(date) => date > new Date()} initialFocus />
                            </PopoverContent>
                            </Popover>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="lastBatteryReplacement"
                        render={({ field }) => (
                        <FormItem className="flex flex-col">
                            <FormLabel>Last Battery Replacement</FormLabel>
                            <Popover>
                            <PopoverTrigger asChild>
                                <FormControl>
                                <Button
                                    variant={"outline"}
                                    className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                                >
                                    {field.value ? (format(field.value, "PPP")) : (<span>Pick a date</span>)}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                                </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={(date) => date > new Date()} initialFocus />
                            </PopoverContent>
                            </Popover>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="upsAssignedToId"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Assigned UPS Technician</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Assign a technician..." />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {usersLoading ? (
                                        <SelectItem value="loading" disabled>Loading users...</SelectItem>
                                    ) : (
                                        <>
                                            <SelectItem value="unassigned">Unassigned</SelectItem>
                                            {users?.map(user => <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>)}
                                        </>
                                    )}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                    <CardTitle>VSD Information</CardTitle>
                    <CardDescription>Details for the Variable Speed Drive controlling this equipment.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-6">
                    <FormField
                        control={form.control}
                        name="vsdId"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>VSD ID</FormLabel>
                            <FormControl>
                            <Input placeholder="e.g., vsd-001" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="model"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>VSD Model</FormLabel>
                            <FormControl>
                            <Input placeholder="e.g., Altek Drive 5000" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="serialNumber"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>VSD Serial Number</FormLabel>
                            <FormControl>
                            <Input placeholder="e.g., SN-A1B2-C3D4" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="installationDate"
                        render={({ field }) => (
                        <FormItem className="flex flex-col">
                            <FormLabel>Installation Date</FormLabel>
                            <Popover>
                            <PopoverTrigger asChild>
                                <FormControl>
                                <Button
                                    variant={"outline"}
                                    className={cn(
                                    "w-full pl-3 text-left font-normal",
                                    !field.value && "text-muted-foreground"
                                    )}
                                >
                                    {field.value ? (
                                    format(field.value, "PPP")
                                    ) : (
                                    <span>Pick a date</span>
                                    )}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                                </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                disabled={(date) =>
                                    date > new Date() || date < new Date("1900-01-01")
                                }
                                initialFocus
                                />
                            </PopoverContent>
                            </Popover>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="assignedToId"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Assigned VSD Technician</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Assign a technician..." />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {usersLoading ? (
                                        <SelectItem value="loading" disabled>Loading users...</SelectItem>
                                    ) : (
                                        <>
                                            <SelectItem value="unassigned">Unassigned</SelectItem>
                                            {users?.map(user => <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>)}
                                        </>
                                    )}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                </CardContent>
              </Card>
              <Card>
                  <CardHeader>
                      <CardTitle>Motor Information</CardTitle>
                      <CardDescription>Details for the motor driven by the VSD.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-6">
                      <FormField control={form.control} name="motorModel" render={({ field }) => (
                          <FormItem><FormLabel>Motor Model</FormLabel><FormControl><Input placeholder="e.g., WEG W22" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="motorPower" render={({ field }) => (
                          <FormItem><FormLabel>Motor Power (kW)</FormLabel><FormControl><Input type="number" placeholder="e.g., 75" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="motorVoltage" render={({ field }) => (
                          <FormItem><FormLabel>Motor Voltage (V)</FormLabel><FormControl><Input type="number" placeholder="e.g., 400" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="motorSerialNumber" render={({ field }) => (
                          <FormItem><FormLabel>Motor Serial Number</FormLabel><FormControl><Input placeholder="e.g., SN-MOTOR-456" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="motorFrameType" render={({ field }) => (
                          <FormItem><FormLabel>Motor Frame Type</FormLabel><FormControl><Input placeholder="e.g., IEC 132" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField
                        control={form.control}
                        name="motorInstallationDate"
                        render={({ field }) => (
                        <FormItem className="flex flex-col">
                            <FormLabel>Installation Date</FormLabel>
                            <Popover>
                            <PopoverTrigger asChild>
                                <FormControl>
                                <Button
                                    variant={"outline"}
                                    className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                                >
                                    {field.value ? (format(field.value, "PPP")) : (<span>Pick a date</span>)}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                                </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={(date) => date > new Date()} initialFocus />
                            </PopoverContent>
                            </Popover>
                            <FormMessage />
                        </FormItem>
                        )}
                      />
                      <FormField control={form.control} name="motorAssignedToId" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Assigned Motor Technician</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                    <SelectTrigger><SelectValue placeholder="Assign a technician..." /></SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {usersLoading ? (
                                        <SelectItem value="loading" disabled>Loading users...</SelectItem>
                                    ) : (
                                        <>
                                            <SelectItem value="unassigned">Unassigned</SelectItem>
                                            {users?.map(user => <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>)}
                                        </>
                                    )}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                      )} />
                  </CardContent>
              </Card>
            </div>
          </div>
          
          <Card>
            <CardHeader>
                <CardTitle>Pump Information</CardTitle>
                <CardDescription>Details for the pump connected to the motor.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
                <div className="space-y-6">
                    <FormField control={form.control} name="pumpType" render={({ field }) => (
                        <FormItem><FormLabel>Pump Type</FormLabel><FormControl><Input placeholder="e.g., Centrifugal" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="pumpBrand" render={({ field }) => (
                        <FormItem><FormLabel>Pump Brand</FormLabel><FormControl><Input placeholder="e.g., KSB" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="pumpSerialNumber" render={({ field }) => (
                        <FormItem><FormLabel>Pump Serial Number</FormLabel><FormControl><Input placeholder="e.g., SN-PUMP-789" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="pumpManufacturer" render={({ field }) => (
                        <FormItem><FormLabel>Manufacturer</FormLabel><FormControl><Input placeholder="e.g., KSB Group" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                    )} />
                </div>
                 <div className="space-y-6">
                    <FormField control={form.control} name="pumpHead" render={({ field }) => (
                        <FormItem><FormLabel>Pump Head (m)</FormLabel><FormControl><Input type="number" placeholder="e.g., 50" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="flowRate" render={({ field }) => (
                        <FormItem><FormLabel>Flow Rate (m³/h)</FormLabel><FormControl><Input type="number" placeholder="e.g., 120" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="pumpImpellerDiameter" render={({ field }) => (
                        <FormItem><FormLabel>Impeller Diameter (mm)</FormLabel><FormControl><Input type="number" placeholder="e.g., 250" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="pumpCommissionDate" render={({ field }) => (
                        <FormItem className="flex flex-col"><FormLabel>Date Commissioned</FormLabel><Popover>
                            <PopoverTrigger asChild><FormControl>
                                <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                    {field.value ? (format(field.value, "PPP")) : (<span>Pick a date</span>)}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                            </FormControl></PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={(date) => date > new Date()} initialFocus /></PopoverContent>
                        </Popover><FormMessage /></FormItem>
                    )} />
                </div>
                 <div className="space-y-6">
                    <FormField control={form.control} name="pumpFlangeSizeIn" render={({ field }) => (
                        <FormItem><FormLabel>Flange Size In (mm)</FormLabel><FormControl><Input type="number" placeholder="e.g., 100" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="pumpFlangeSizeOutlet" render={({ field }) => (
                        <FormItem><FormLabel>Flange Size Outlet (mm)</FormLabel><FormControl><Input type="number" placeholder="e.g., 80" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                    )} />
                </div>
                <div className="space-y-6">
                    <FormField control={form.control} name="pumpFrameSize" render={({ field }) => (
                        <FormItem><FormLabel>Frame Size</FormLabel><FormControl><Input placeholder="e.g., 160M" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="pumpFrameType" render={({ field }) => (
                        <FormItem><FormLabel>Frame Type</FormLabel><FormControl><Input placeholder="e.g., Cast Iron" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                    )} />
                </div>

                <FormField control={form.control} name="pumpAssignedToId" render={({ field }) => (
                    <FormItem className="md:col-span-2">
                        <FormLabel>Assigned Pump Technician</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                                <SelectTrigger><SelectValue placeholder="Assign a technician..." /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                {usersLoading ? (
                                    <SelectItem value="loading" disabled>Loading users...</SelectItem>
                                ) : (
                                    <>
                                        <SelectItem value="unassigned">Unassigned</SelectItem>
                                        {users?.map(user => <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>)}
                                    </>
                                )}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                )} />
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button type="submit">Save Equipment</Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
